'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentDateBrazil, currentPeriodBrazil } from '@/lib/finance/types'
import { getSignedInHousehold } from '@/lib/finance/queries'
import { createClient } from '@/lib/supabase/server'

const currentPeriod = () => `${currentPeriodBrazil()}-01`
const valueFrom = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim()
const amountFrom = (value: string) => {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return 0
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN
  const amount = Number(normalized)
  return Math.abs(amount) <= 1_000_000_000 ? amount : Number.NaN
}

export async function initializeHouseholdAction(formData: FormData) {
  const { supabase, user, household: existingHousehold } = await getSignedInHousehold()
  if (!user) redirect('/auth/login')

  const householdName = valueFrom(formData, 'householdName') || 'Minha casa'
  let householdId: string = existingHousehold?.id ?? ''
  if (!householdId) {
    const { data: createdHouseholdId, error: createError } = await supabase.rpc('create_household', { household_name: householdName })
    if (createError || !createdHouseholdId) redirect('/?setupError=household')
    householdId = createdHouseholdId
  }

  const categoryRows = [
    { household_id: householdId, name: 'Casa', color: '#698872' },
    { household_id: householdId, name: 'Gastar Henrique', color: '#bd9774' },
    { household_id: householdId, name: 'Gastar Bia', color: '#9b7770' },
  ]
  const { error: categoryError } = await supabase
    .from('expense_categories')
    .upsert(categoryRows, { onConflict: 'household_id,name', ignoreDuplicates: true })
  if (categoryError) redirect('/?setupError=import')
  const { data: categories, error: categoryReadError } = await supabase
    .from('expense_categories')
    .select('id,name')
    .eq('household_id', householdId)
  if (categoryReadError) redirect('/?setupError=import')
  const categoryByName = new Map((categories ?? []).map((category) => [category.name, category.id]))
  const incomeRows = [
    { household_id: householdId, source: 'Salário base Henrique', planned_amount: 10390, recurrence: 'monthly' },
    { household_id: householdId, source: 'Salário base Bia', planned_amount: 2125, recurrence: 'monthly' },
    { household_id: householdId, source: 'VT', planned_amount: 270, recurrence: 'monthly' },
    { household_id: householdId, source: 'VA', planned_amount: 252, recurrence: 'monthly' },
  ]
  const { error: incomeError } = await supabase
    .from('income_templates')
    .upsert(incomeRows, { onConflict: 'household_id,source', ignoreDuplicates: true })
  if (incomeError) redirect('/?setupError=import')

  const expenses: Array<[string, number, string, string, number | null, number | null, string | null]> = [
    ['Transporte Público trabalho Bia', 270, 'Casa', 'monthly', null, null, 'A linha aparece separada do subtotal Casa (R$ 2.686,40); incluindo-a, as despesas mensais somam R$ 2.956,40.'],
    ['Energia', 280, 'Casa', 'monthly', 23, null, null],
    ['Internet', 113, 'Casa', 'monthly', 5, null, null],
    ['4G Sr. Mor', 28.5, 'Casa', 'monthly', 5, null, null],
    ['4G Sra. Mor', 44.9, 'Casa', 'monthly', 5, null, null],
    ['Condomínio', 330, 'Casa', 'monthly', 10, null, null],
    ['Remedinho', 100, 'Casa', 'monthly', null, null, 'A planilha informa vencimento 0; confirmar a data.'],
    ['Mercado', 1300, 'Casa', 'monthly', null, null, 'A planilha informa vencimento 0; confirmar a data.'],
    ['Transporte Público trabalho Henrique', 160, 'Casa', 'monthly', null, null, 'A planilha informa vencimento 0; confirmar a data.'],
    ['Uber', 300, 'Casa', 'monthly', null, null, 'A planilha informa vencimento 0; confirmar a data.'],
    ['Corte de Cabelo SR', 30, 'Casa', 'monthly', null, null, 'A planilha informa vencimento 0; confirmar a data.'],
    ['PS Plus', 560, 'Gastar Henrique', 'annual', null, null, 'A planilha marca recorrência anual; o mês de vencimento não foi informado.'],
  ]
  const expenseRows = expenses.map(([name, plannedAmount, categoryName, recurrence, dueDay, dueMonth, notes]) => ({
    household_id: householdId,
    category_id: categoryByName.get(categoryName) ?? null,
    name,
    planned_amount: plannedAmount,
    due_day: dueDay,
    due_month: dueMonth,
    recurrence,
    notes,
  }))
  const { error: expenseError } = await supabase
    .from('expense_templates')
    .upsert(expenseRows, { onConflict: 'household_id,name', ignoreDuplicates: true })
  if (expenseError) redirect('/?setupError=import')

  const allocations = [
    { label: 'Dízimo', planned_amount: 1000, allocation_type: 'other' },
    { label: 'Aposentadoria', planned_amount: 1000, allocation_type: 'savings' },
    { label: 'Viajar', planned_amount: 1800, allocation_type: 'savings' },
    { label: 'Nosso Crescimento', planned_amount: 690, allocation_type: 'savings' },
    { label: 'Gastar Henrique', planned_amount: 750, allocation_type: 'personal' },
    { label: 'Gastar Bia', planned_amount: 750, allocation_type: 'personal' },
    { label: 'Meta de Vida', planned_amount: 4000, allocation_type: 'savings' },
    { label: 'Casa', planned_amount: 90.6, allocation_type: 'remainder' },
  ].map((row) => ({
    household_id: householdId,
    ...row,
    notes: row.allocation_type === 'other' ? 'Tipo de alocação não especificado na planilha; revisar.' : null,
  }))
  const { error: allocationError } = await supabase
    .from('budget_allocations')
    .upsert(allocations, { onConflict: 'household_id,label', ignoreDuplicates: true })
  if (allocationError) redirect('/?setupError=import')

  const accounts = [
    { name: 'Lua de mél', opening_balance: 6708, description: 'Cofres - Bia. Valor informado na planilha; data do saldo não informada. Confirmar antes de considerar atual.' },
    { name: 'Reserva casa', opening_balance: 6529, description: 'Cofres - Bia. Valor informado na planilha; data do saldo não informada. Confirmar antes de considerar atual.' },
    { name: 'Convidados a mais', opening_balance: 0, description: 'Cofres - Bia. A planilha mostra “-” no valor; saldo não informado, revisar.' },
    { name: 'Presentes de casamento', opening_balance: 4711, description: 'Cofres - Bia. Valor informado na planilha; data do saldo não informada. Confirmar antes de considerar atual.' },
    { name: 'Fotógrafo', opening_balance: 1400, description: 'Cofres - Bia. Valor informado na planilha; data do saldo não informada. Confirmar antes de considerar atual.' },
    { name: '2ª Parcela Milkshake', opening_balance: 623, description: 'Cofres - Bia. Valor informado na planilha; data do saldo não informada. Confirmar antes de considerar atual.' },
  ].map((account) => ({ household_id: householdId, account_type: 'savings', ...account }))
  const { error: accountError } = await supabase
    .from('financial_accounts')
    .upsert(accounts, { onConflict: 'household_id,name', ignoreDuplicates: true })
  if (accountError) redirect('/?setupError=import')

  const { error: generateError } = await supabase.rpc('generate_monthly_finances', {
    target_household_id: householdId,
    target_period: currentPeriod(),
  })
  if (generateError) redirect('/?setupError=generate')

  revalidatePath('/')
  redirect('/')
}

async function requireHousehold() {
  const { supabase, user, household } = await getSignedInHousehold()
  if (!user) redirect('/auth/login')
  if (!household) redirect('/')
  return { supabase, user, household }
}

export async function updateMonthlyExpenseAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const expenseId = valueFrom(formData, 'expenseId')
  const status = valueFrom(formData, 'status')
  const amount = amountFrom(valueFrom(formData, 'actualAmount'))
  const paidOn = valueFrom(formData, 'paidOn') || null
  const accountId = valueFrom(formData, 'accountId') || null
  const notes = valueFrom(formData, 'notes')
  const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  if (!isUuid(expenseId) || !['unpaid', 'credit_card', 'paid'].includes(status) || !Number.isFinite(amount) || amount < 0 || (paidOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) || (accountId !== null && !isUuid(accountId))) redirect('/?actionError=payment')

  const { error } = await supabase.rpc('update_monthly_expense', {
    target_expense_id: expenseId,
    target_status: status,
    target_actual_amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    target_paid_on: paidOn,
    target_account_id: accountId,
    target_notes: notes,
  })
  if (error) redirect('/?actionError=payment')
  revalidatePath('/')
  redirect('/')
}

export async function updateIncomeTemplateAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const source = valueFrom(formData, 'source')
  const amount = amountFrom(valueFrom(formData, 'plannedAmount'))
  if (!source || source.length > 120 || !Number.isFinite(amount) || amount < 0) redirect('/?view=Planejamento&actionError=income')
  const { error } = await supabase.from('income_templates').update({ planned_amount: amount }).eq('household_id', household.id).eq('source', source)
  if (error) redirect('/?view=Planejamento&actionError=income')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function updateMonthlyIncomeAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const source = valueFrom(formData, 'source')
  const period = valueFrom(formData, 'period')
  const amount = amountFrom(valueFrom(formData, 'actualAmount'))
  const receivedOn = valueFrom(formData, 'receivedOn') || null
  if (!source || source.length > 120 || !/^\d{4}-\d{2}-01$/.test(period) || !Number.isFinite(amount) || amount < 0 || (receivedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn))) redirect('/?view=Planejamento&actionError=income')
  const { error } = await supabase.from('monthly_incomes').update({ actual_amount: amount, received_on: receivedOn }).eq('household_id', household.id).eq('source', source).eq('period', period)
  if (error) redirect('/?view=Planejamento&actionError=income')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function createExpenseTemplateAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const templateId = valueFrom(formData, 'templateId')
  const name = valueFrom(formData, 'name')
  const amount = amountFrom(valueFrom(formData, 'amount'))
  const recurrence = valueFrom(formData, 'recurrence')
  const dueDay = Number(valueFrom(formData, 'dueDay')) || null
  const dueMonth = Number(valueFrom(formData, 'dueMonth')) || null
  if (!name || name.length > 120 || !Number.isFinite(amount) || amount < 0 || !['monthly', 'annual', 'one_time'].includes(recurrence) || (dueDay !== null && (dueDay < 1 || dueDay > 31)) || (dueMonth !== null && (dueMonth < 1 || dueMonth > 12))) redirect('/?view=Planejamento&actionError=template')

  const values = {
    name,
    planned_amount: amount,
    category_id: valueFrom(formData, 'categoryId') || null,
    account_id: valueFrom(formData, 'accountId') || null,
    due_day: dueDay,
    due_month: dueMonth,
    recurrence,
    notes: valueFrom(formData, 'notes') || null,
  }
  const { error } = templateId
    ? await supabase.from('expense_templates').update(values).eq('id', templateId).eq('household_id', household.id)
    : await supabase.from('expense_templates').insert({ ...values, household_id: household.id })
  if (error) redirect('/?view=Planejamento&actionError=template')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function toggleExpenseTemplateAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const templateId = valueFrom(formData, 'templateId')
  const isActive = valueFrom(formData, 'isActive') === 'true'
  const { error } = await supabase.from('expense_templates').update({ is_active: !isActive }).eq('id', templateId).eq('household_id', household.id)
  if (error) redirect('/?view=Planejamento&actionError=template')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function createCategoryAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const name = valueFrom(formData, 'name')
  if (!name || name.length > 80) redirect('/?view=Planejamento&actionError=category')
  const { error } = await supabase.from('expense_categories').insert({ household_id: household.id, name })
  if (error) redirect('/?view=Planejamento&actionError=category')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function updateCategoryAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const categoryId = valueFrom(formData, 'categoryId')
  const name = valueFrom(formData, 'name')
  if (!categoryId || !name || name.length > 80) redirect('/?view=Planejamento&actionError=category')
  const { error } = await supabase.from('expense_categories').update({ name }).eq('id', categoryId).eq('household_id', household.id)
  if (error) redirect('/?view=Planejamento&actionError=category')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function archiveCategoryAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const categoryId = valueFrom(formData, 'categoryId')
  if (!categoryId) redirect('/?view=Planejamento&actionError=category')
  const { error } = await supabase.from('expense_categories').update({ is_active: false }).eq('id', categoryId).eq('household_id', household.id)
  if (error) redirect('/?view=Planejamento&actionError=category')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function createBudgetAllocationAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const allocationId = valueFrom(formData, 'allocationId')
  const label = valueFrom(formData, 'label')
  const plannedAmount = amountFrom(valueFrom(formData, 'plannedAmount'))
  const allocationType = valueFrom(formData, 'allocationType')
  if (!label || label.length > 120 || !Number.isFinite(plannedAmount) || plannedAmount < 0) redirect('/?view=Planejamento&actionError=allocation')
  const values = {
    label,
    planned_amount: plannedAmount,
    allocation_type: ['fixed_expense', 'savings', 'personal', 'remainder', 'other'].includes(allocationType) ? allocationType : 'other',
  }
  const { error } = allocationId
    ? await supabase.from('budget_allocations').update(values).eq('id', allocationId).eq('household_id', household.id)
    : await supabase.from('budget_allocations').insert({ ...values, household_id: household.id })
  if (error) redirect('/?view=Planejamento&actionError=allocation')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function archiveBudgetAllocationAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const allocationId = valueFrom(formData, 'allocationId')
  if (!allocationId) redirect('/?view=Planejamento&actionError=allocation')
  const { error } = await supabase.from('budget_allocations').update({ is_active: false }).eq('id', allocationId).eq('household_id', household.id)
  if (error) redirect('/?view=Planejamento&actionError=allocation')
  revalidatePath('/')
  redirect('/?view=Planejamento')
}

export async function createAccountAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const name = valueFrom(formData, 'name')
  const openingBalance = amountFrom(valueFrom(formData, 'openingBalance'))
  const accountType = valueFrom(formData, 'accountType')
  if (!name || name.length > 100 || !Number.isFinite(openingBalance) || !['checking', 'savings', 'cash', 'investment', 'credit_card', 'other'].includes(accountType)) redirect('/?view=Contas%20%26%20reservas&actionError=account')
  const { error } = await supabase.from('financial_accounts').insert({
    household_id: household.id,
    name,
    account_type: accountType,
    opening_balance: openingBalance,
    description: valueFrom(formData, 'description') || null,
  })
  if (error) redirect('/?view=Contas%20%26%20reservas&actionError=account')
  revalidatePath('/')
  redirect('/?view=Contas%20%26%20reservas')
}

export async function createAccountTransactionAction(formData: FormData) {
  const { supabase, household } = await requireHousehold()
  const accountId = valueFrom(formData, 'accountId')
  const amount = amountFrom(valueFrom(formData, 'amount'))
  const direction = valueFrom(formData, 'direction')
  if (!accountId || !Number.isFinite(amount) || amount <= 0 || !['deposit', 'withdrawal'].includes(direction)) redirect('/?view=Contas%20%26%20reservas&actionError=transaction')
  const { error } = await supabase.from('account_transactions').insert({
    household_id: household.id,
    account_id: accountId,
    direction,
    amount,
    occurred_on: valueFrom(formData, 'occurredOn') || currentDateBrazil(),
    description: valueFrom(formData, 'description') || null,
  })
  if (error) redirect('/?view=Contas%20%26%20reservas&actionError=transaction')
  revalidatePath('/')
  redirect('/?view=Contas%20%26%20reservas')
}

export async function createHouseholdInviteAction() {
  const { supabase, household } = await requireHousehold()
  const { data: token, error } = await supabase.rpc('create_household_invite', { target_household_id: household.id })
  if (error || !token) redirect('/?view=Configurações&actionError=invite')
  redirect(`/?view=${encodeURIComponent('Configurações')}&invite=${encodeURIComponent(token)}`)
}

export async function acceptHouseholdInviteAction(formData: FormData) {
  const { supabase, user } = await getSignedInHousehold()
  const code = valueFrom(formData, 'code')
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/invite?code=${code}`)}`)
  if (!code || code.length > 128) redirect('/invite?error=invalid')
  const { error } = await supabase.rpc('accept_household_invite', { target_code: code })
  if (error) redirect('/invite?error=invalid')
  revalidatePath('/')
  redirect('/')
}
