-- Ensure legacy superadmin table keeps working while we migrate flags
update public.profiles
set is_superadmin = true
where id in (select user_id from public.superadmins)
  and is_superadmin = false;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_superadmin
    from public.profiles p
    where p.id = auth.uid()
  ), false)
  or exists (
    select 1
    from public.superadmins s
    where s.user_id = auth.uid()
  );
$$;
