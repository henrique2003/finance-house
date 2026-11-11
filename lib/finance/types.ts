export type Expense = {
  id: string
  name: string
  planned_amount: number | string
  actual_amount: number | string
  due_date: string | null
  paid_on: string | null
  status: 'unpaid' | 'credit_card' | 'paid'
  notes: string | null
  category_name: string
  account_id: string | null
  account_name: string
}

export type FinanceData = {
  userEmail: string
  household: { id: string; name: string; owner_user_id: string }
  period: string
  expenses: Expense[]
  templates: Array<{ id: string; name: string; planned_amount: number | string; due_day: number | null; due_month: number | null; recurrence: string; is_active: boolean; notes: string | null; category_id: string | null; account_id: string | null }>
  incomeTemplates: Array<{ source: string; planned_amount: number | string; recurrence: string }>
  categories: Array<{ id: string; name: string; is_active: boolean }>
  accounts: Array<{ id: string; name: string; account_type: string; opening_balance: number | string; description: string | null; balance: number }>
  incomes: Array<{ source: string; planned_amount: number | string; actual_amount: number | string; received_on: string | null }>
  allocations: Array<{ id: string; label: string; planned_amount: number | string; allocation_type: string; notes: string | null; is_active: boolean }>
  history: Array<{ period: string; status: string; planned_amount: number | string; actual_amount: number | string; category_name: string }>
  transactions: Array<{ account_id: string; direction: string; amount: number | string; occurred_on: string; description: string | null }>
}

export const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const currentDateBrazil = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}
export const currentPeriodBrazil = () => currentDateBrazil().slice(0, 7)
export const monthLabel = (period: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`))
export const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : 'Data a confirmar'
