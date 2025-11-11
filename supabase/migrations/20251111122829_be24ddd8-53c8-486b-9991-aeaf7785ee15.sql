-- Step 1: Create superadmins table first
create table if not exists public.superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Step 2: Enable RLS on superadmins
alter table public.superadmins enable row level security;

-- Step 3: Create is_superadmin function (now that table exists)
create or replace function public.is_superadmin()
returns boolean 
language sql 
stable 
security definer
set search_path = public
as $$
  select exists (
    select 1 
    from public.superadmins 
    where user_id = auth.uid()
  );
$$;

-- Step 4: Create RLS policies using the function
create policy "Superadmins can view superadmins"
  on public.superadmins for select
  to authenticated
  using (public.is_superadmin());

create policy "Superadmins can insert superadmins"
  on public.superadmins for insert
  to authenticated
  with check (public.is_superadmin());

create policy "Superadmins can delete superadmins"
  on public.superadmins for delete
  to authenticated
  using (public.is_superadmin());

-- Step 5: Create indices
create index if not exists idx_companies_status on public.companies(status);
create index if not exists idx_audit_logs_company_time on public.audit_logs(company_id, created_at desc);
create index if not exists idx_superadmins_user_id on public.superadmins(user_id);