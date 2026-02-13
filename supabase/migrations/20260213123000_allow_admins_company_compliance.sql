-- Allow admins to read/update company compliance settings (previously only owners)
do $$
begin
  -- Select policy
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_compliance_settings'
      and policyname = 'owners_select_settings'
  ) then
    drop policy "owners_select_settings" on public.company_compliance_settings;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_compliance_settings'
      and policyname = 'owners_admins_select_settings'
  ) then
    create policy owners_admins_select_settings
      on public.company_compliance_settings
      for select
      using (
        exists (
          select 1
          from public.memberships m
          where m.company_id = company_id
            and m.user_id = auth.uid()
            and m.role in ('owner','admin')
        )
      );
  end if;

  -- Update policy
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_compliance_settings'
      and policyname = 'owners_update_settings'
  ) then
    drop policy "owners_update_settings" on public.company_compliance_settings;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_compliance_settings'
      and policyname = 'owners_admins_update_settings'
  ) then
    create policy owners_admins_update_settings
      on public.company_compliance_settings
      for update
      using (
        exists (
          select 1
          from public.memberships m
          where m.company_id = company_id
            and m.user_id = auth.uid()
            and m.role in ('owner','admin')
        )
      );
  end if;
end$$;

-- Ensure RLS remains enabled
alter table public.company_compliance_settings enable row level security;
