import { createClient } from '@/lib/supabase/server'

export async function getAllMonthlyExpenses(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string) {
  const pageSize = 1000
  const rows: Array<{ period: string; status: string; planned_amount: number | string; actual_amount: number | string; category_id: string | null }> = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('monthly_expenses')
      .select('period,status,planned_amount,actual_amount,category_id')
      .eq('household_id', householdId)
      .order('period', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}

export async function getAllAccountTransactions(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string) {
  const pageSize = 1000
  const rows: Array<{ account_id: string; direction: string; amount: number | string; occurred_on: string; description: string | null }> = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('account_transactions')
      .select('account_id,direction,amount,occurred_on,description')
      .eq('household_id', householdId)
      .order('occurred_on', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}

export async function getSignedInHousehold() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { supabase, user: null, household: null }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return { supabase, user, household: null }

  const { data: household } = await supabase
    .from('households')
    .select('id, name, owner_user_id')
    .eq('id', membership.household_id)
    .maybeSingle()

  return { supabase, user, household }
}
