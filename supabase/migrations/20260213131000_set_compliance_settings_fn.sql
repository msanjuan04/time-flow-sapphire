-- Security definer function to upsert compliance settings without hitting table RLS
create or replace function public.set_compliance_settings(
  _company_id uuid,
  _max_week_hours integer,
  _max_month_hours integer,
  _min_hours_between_shifts integer,
  _allowed_checkin_start time,
  _allowed_checkin_end time,
  _allow_outside_schedule boolean
)
returns public.company_compliance_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.company_compliance_settings;
begin
  insert into public.company_compliance_settings (
    company_id,
    max_week_hours,
    max_month_hours,
    min_hours_between_shifts,
    allowed_checkin_start,
    allowed_checkin_end,
    allow_outside_schedule
  )
  values (
    _company_id,
    _max_week_hours,
    _max_month_hours,
    _min_hours_between_shifts,
    _allowed_checkin_start,
    _allowed_checkin_end,
    coalesce(_allow_outside_schedule, false)
  )
  on conflict (company_id) do update set
    max_week_hours = excluded.max_week_hours,
    max_month_hours = excluded.max_month_hours,
    min_hours_between_shifts = excluded.min_hours_between_shifts,
    allowed_checkin_start = excluded.allowed_checkin_start,
    allowed_checkin_end = excluded.allowed_checkin_end,
    allow_outside_schedule = excluded.allow_outside_schedule,
    updated_at = now();

  select * into _row from public.company_compliance_settings where company_id = _company_id;
  return _row;
end;
$$;

grant execute on function public.set_compliance_settings(
  uuid, integer, integer, integer, time, time, boolean
) to authenticated, anon;
