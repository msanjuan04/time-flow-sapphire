-- Create table for company-level compliance settings
create table if not exists public.company_compliance_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  max_week_hours integer,
  max_month_hours integer,
  min_hours_between_shifts integer,
  allowed_checkin_start time,
  allowed_checkin_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger to keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_company_compliance_settings_updated_at on public.company_compliance_settings;
create trigger trg_company_compliance_settings_updated_at
before update on public.company_compliance_settings
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.company_compliance_settings enable row level security;

-- Policy: owners can select/update their company settings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_compliance_settings'
      and policyname = 'owners_select_settings'
  ) then
    create policy owners_select_settings
      on public.company_compliance_settings
      for select
      using (
        exists (
          select 1 from public.memberships m
          where m.company_id = company_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_compliance_settings'
      and policyname = 'owners_update_settings'
  ) then
    create policy owners_update_settings
      on public.company_compliance_settings
      for update
      using (
        exists (
          select 1 from public.memberships m
          where m.company_id = company_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
        )
      );
  end if;

  -- Workers solo SELECT
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_compliance_settings'
      and policyname = 'workers_select_settings'
  ) then
    create policy workers_select_settings
      on public.company_compliance_settings
      for select
      using (
        exists (
          select 1 from public.memberships m
          where m.company_id = company_id
            and m.user_id = auth.uid()
            and m.role = 'worker'
        )
      );
  end if;
end$$;

-- Helpful index
create unique index if not exists idx_company_compliance_settings_company_id
  on public.company_compliance_settings(company_id);

