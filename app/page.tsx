import { redirect } from 'next/navigation'
import { FinanceWorkspace, HouseholdSetup } from '@/components/finance-workspace'
import { currentPeriodBrazil, type FinanceData } from '@/lib/finance/types'
import { getAllAccountTransactions, getAllMonthlyExpenses, getSignedInHousehold } from '@/lib/finance/queries'

export const dynamic = 'force-dynamic'

type PageProps = { searchParams: Promise<{ month?: string; view?: string; invite?: string; setupError?: string; actionError?: string }> }

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const { supabase, user, household } = await getSignedInHousehold()
  if (!user) redirect('/auth/login')
  if (!household) return <HouseholdSetup email={user.email ?? ''} error={params.setupError} />

  const period = params.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : currentPeriodBrazil()
  const monthStart = `${period}-01`
  const { error: generateError } = await supabase.rpc('generate_monthly_finances', {
    target_household_id: household.id,
    target_period: monthStart,
  })

  const results = await Promise.all([
    supabase.from('monthly_expenses').select('id,name,category_id,account_id,period,planned_amount,actual_amount,due_date,paid_on,status,notes').eq('household_id', household.id).eq('period', monthStart).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('expense_templates').select('id,name,category_id,account_id,planned_amount,due_day,due_month,recurrence,is_active,notes').eq('household_id', household.id).order('name'),
    supabase.from('expense_categories').select('id,name,is_active').eq('household_id', household.id).order('name'),
    supabase.from('financial_accounts').select('id,name,account_type,opening_balance,description').eq('household_id', household.id).eq('is_active', true).order('name'),
    supabase.from('income_templates').select('source,planned_amount,recurrence').eq('household_id', household.id).eq('is_active', true).order('source'),
    supabase.from('monthly_incomes').select('source,planned_amount,actual_amount,received_on').eq('household_id', household.id).eq('period', monthStart).order('source'),
    supabase.from('budget_allocations').select('id,label,planned_amount,allocation_type,notes,is_active').eq('household_id', household.id).eq('is_active', true).order('label'),
    getAllMonthlyExpenses(supabase, household.id),
    getAllAccountTransactions(supabase, household.id),
  ])
  const [expenseResult, templateResult, categoryResult, accountResult, incomeTemplateResult, incomeResult, allocationResult, historyResult, transactionResult] = results
  const categories = categoryResult.data ?? []
  const accounts = accountResult.data ?? []
  const categoryNames = new Map(categories.map((item) => [item.id, item.name]))
  const accountNames = new Map(accounts.map((item) => [item.id, item.name]))
  const transactions = transactionResult.data ?? []
  const balances = new Map<string, number>()
  for (const transaction of transactions) {
    const direction = transaction.direction === 'deposit' ? 1 : -1
    const currentCents = Math.round((balances.get(transaction.account_id) ?? 0) * 100)
    const movementCents = Math.round(Number(transaction.amount) * 100) * direction
    balances.set(transaction.account_id, (currentCents + movementCents) / 100)
  }

  const hasReadError = results.some((result) => result.error)
  const data: FinanceData = {
    userEmail: user.email ?? '',
    household,
    period,
    expenses: (expenseResult.data ?? []).map((row) => ({
      ...row,
      category_name: categoryNames.get(row.category_id ?? '') ?? 'Sem categoria',
      account_name: accountNames.get(row.account_id ?? '') ?? 'A definir',
    })),
    templates: templateResult.data ?? [],
    incomeTemplates: incomeTemplateResult.data ?? [],
    categories,
    accounts: accounts.map((account) => ({
      ...account,
      balance: Number(account.opening_balance) + (balances.get(account.id) ?? 0),
    })),
    incomes: incomeResult.data ?? [],
    allocations: allocationResult.data ?? [],
    history: (historyResult.data ?? []).map((row) => ({
      ...row,
      category_name: categoryNames.get(row.category_id ?? '') ?? 'Sem categoria',
    })),
    transactions,
  }

  return <FinanceWorkspace data={data} initialView={params.view ?? 'Dashboard'} inviteToken={params.invite ?? ''} actionError={hasReadError ? 'read' : params.actionError} generationWarning={generateError ? 'generate' : ''} />
}
