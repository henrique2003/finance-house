create extension if not exists pg_cron;

create or replace function public.generate_monthly_finances(target_household_id uuid, target_period date)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare month_start date := date_trunc('month', target_period::timestamp)::date;
declare month_number integer := extract(month from date_trunc('month', target_period::timestamp));
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_household_member(target_household_id) then
    raise exception 'Household access denied';
  end if;

  insert into public.monthly_incomes(household_id, template_id, period, source, planned_amount)
  select target_household_id, t.id, month_start, t.source, t.planned_amount
  from public.income_templates t
  where t.household_id = target_household_id and t.is_active and t.recurrence = 'monthly'
  on conflict (household_id, template_id, period) do nothing;

  insert into public.monthly_expenses(household_id, template_id, category_id, account_id, period, name, planned_amount, due_date, status, notes)
  select target_household_id, t.id, t.category_id, t.account_id, month_start, t.name, t.planned_amount,
    case when t.due_day is null then null else make_date(extract(year from month_start)::integer, extract(month from month_start)::integer, least(t.due_day, extract(day from (month_start + interval '1 month - 1 day'))::integer)) end,
    'unpaid', t.notes
  from public.expense_templates t
  where t.household_id = target_household_id and t.is_active
    and (t.recurrence = 'monthly' or (t.recurrence = 'annual' and t.due_month = month_number))
  on conflict (household_id, template_id, period) do nothing;
end;
$function$;

create or replace function public.generate_monthly_finances_for_all_households()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare household_record record;
declare month_start date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  for household_record in select id from public.households loop
    perform public.generate_monthly_finances(household_record.id, month_start);
  end loop;
end;
$function$;

revoke all on function public.generate_monthly_finances_for_all_households() from public, anon, authenticated;
grant execute on function public.generate_monthly_finances_for_all_households() to postgres;

do $schedule$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'casa-clara-monthly-finances';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('casa-clara-monthly-finances', '0 3 1 * *', 'select public.generate_monthly_finances_for_all_households()');
end;
$schedule$;
