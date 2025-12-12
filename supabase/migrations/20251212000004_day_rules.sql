-- Tabla de reglas globales por empresa
create table if not exists public.company_day_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  allow_sunday_clock boolean not null default false,
  holiday_clock_policy text not null default 'block' check (holiday_clock_policy in ('allow','require_reason','block')),
  special_day_policy text not null default 'restrict' check (special_day_policy in ('allow','restrict')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

-- Trigger updated_at
drop trigger if exists trg_company_day_rules_updated_at on public.company_day_rules;
create trigger trg_company_day_rules_updated_at
before update on public.company_day_rules
for each row execute function public.set_updated_at();

-- RLS
alter table public.company_day_rules enable row level security;

drop policy if exists owners_select_company_day_rules on public.company_day_rules;
create policy owners_select_company_day_rules
  on public.company_day_rules
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

drop policy if exists owners_update_company_day_rules on public.company_day_rules;
create policy owners_update_company_day_rules
  on public.company_day_rules
  for update
  using (
    exists (
      select 1 from public.memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

drop policy if exists workers_select_company_day_rules on public.company_day_rules;
create policy workers_select_company_day_rules
  on public.company_day_rules
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role = 'worker'
    )
  );

-- Tabla de overrides por trabajador
create table if not exists public.worker_day_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  allow_sunday_clock boolean,
  holiday_clock_policy text check (holiday_clock_policy in ('allow','require_reason','block')),
  special_day_policy text check (special_day_policy in ('allow','restrict')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

drop trigger if exists trg_worker_day_rules_updated_at on public.worker_day_rules;
create trigger trg_worker_day_rules_updated_at
before update on public.worker_day_rules
for each row execute function public.set_updated_at();

alter table public.worker_day_rules enable row level security;

drop policy if exists owners_all_worker_day_rules on public.worker_day_rules;
create policy owners_all_worker_day_rules
  on public.worker_day_rules
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

drop policy if exists workers_select_self_worker_day_rules on public.worker_day_rules;
create policy workers_select_self_worker_day_rules
  on public.worker_day_rules
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role = 'worker'
    )
  );

-- Tabla opcional para marcar días especiales por empresa
create table if not exists public.company_special_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  date date not null,
  is_special boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, date)
);

drop trigger if exists trg_company_special_days_updated_at on public.company_special_days;
create trigger trg_company_special_days_updated_at
before update on public.company_special_days
for each row execute function public.set_updated_at();

alter table public.company_special_days enable row level security;

drop policy if exists owners_all_company_special_days on public.company_special_days;
create policy owners_all_company_special_days
  on public.company_special_days
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

drop policy if exists workers_select_company_special_days on public.company_special_days;
create policy workers_select_company_special_days
  on public.company_special_days
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role = 'worker'
    )
  );
