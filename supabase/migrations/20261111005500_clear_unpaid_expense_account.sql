create or replace function public.update_monthly_expense(target_expense_id uuid, target_status text, target_actual_amount numeric default null, target_paid_on date default null, target_account_id uuid default null, target_notes text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  expense_row public.monthly_expenses%rowtype;
  payment_id uuid;
  payment_amount numeric(14,2);
begin
  if target_status not in ('unpaid','credit_card','paid') then raise exception 'Invalid expense status'; end if;
  select * into expense_row from public.monthly_expenses where id = target_expense_id;
  if not found or not public.is_household_member(expense_row.household_id) then raise exception 'Expense not found'; end if;
  if expense_row.status = 'paid' and target_status <> 'paid' then raise exception 'A recorded payment cannot be reverted; create a correcting transaction instead'; end if;

  if target_status = 'paid' and expense_row.status <> 'paid' then
    payment_amount := coalesce(target_actual_amount, expense_row.planned_amount);
    if payment_amount <= 0 then raise exception 'Paid amount must be greater than zero'; end if;
    insert into public.expense_payments(household_id, expense_id, account_id, amount, paid_at, notes)
      values (expense_row.household_id, expense_row.id, target_account_id, payment_amount,
        coalesce(target_paid_on::timestamptz, now()), target_notes)
      returning id into payment_id;
    if target_account_id is not null then
      insert into public.account_transactions(household_id, account_id, payment_id, direction, amount, occurred_on, description)
      values (expense_row.household_id, target_account_id, payment_id, 'withdrawal', payment_amount,
        coalesce(target_paid_on, current_date), expense_row.name);
    end if;
  end if;

  update public.monthly_expenses
  set status = target_status,
      actual_amount = coalesce(target_actual_amount, actual_amount),
      paid_on = case when target_status = 'paid' then coalesce(target_paid_on, current_date) else null end,
      account_id = case when expense_row.status = 'paid' then expense_row.account_id else target_account_id end,
      notes = coalesce(target_notes, notes)
  where id = target_expense_id;
end;
$function$;
