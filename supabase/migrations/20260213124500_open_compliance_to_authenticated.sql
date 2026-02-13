-- Broaden RLS: allow any authenticated user to select/insert/update company_compliance_settings rows
-- (still constrained by explicit company_id provided by the client)
do $$
begin
  -- Drop prior policies if exist
  if exists (select 1 from pg_policies where schemaname='public' and tablename='company_compliance_settings' and policyname='company_members_select_settings') then
    drop policy company_members_select_settings on public.company_compliance_settings;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='company_compliance_settings' and policyname='company_members_update_settings') then
    drop policy company_members_update_settings on public.company_compliance_settings;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='company_compliance_settings' and policyname='company_members_insert_settings') then
    drop policy company_members_insert_settings on public.company_compliance_settings;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='company_compliance_settings' and policyname='owners_admins_select_settings') then
    drop policy owners_admins_select_settings on public.company_compliance_settings;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='company_compliance_settings' and policyname='owners_admins_update_settings') then
    drop policy owners_admins_update_settings on public.company_compliance_settings;
  end if;

  create policy company_compliance_select_any_auth
    on public.company_compliance_settings
    for select
    using (auth.uid() is not null);

  create policy company_compliance_update_any_auth
    on public.company_compliance_settings
    for update
    using (auth.uid() is not null);

  create policy company_compliance_insert_any_auth
    on public.company_compliance_settings
    for insert
    with check (auth.uid() is not null);
end$$;

alter table public.company_compliance_settings enable row level security;
