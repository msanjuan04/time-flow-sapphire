-- Step 2: Append-only trigger function for time_events (trigger creation pending external approval)
create or replace function public.trg_time_events_append_only()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE') then
    insert into public.event_revisions(event_id, action, previous_value, new_value, reason, changed_by, hash)
    values (old.id, 'update', to_jsonb(old), to_jsonb(new), current_setting('app.change_reason', true), auth.uid(), null);
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.event_revisions(event_id, action, previous_value, new_value, reason, changed_by, hash)
    values (old.id, 'delete', to_jsonb(old), null, current_setting('app.change_reason', true), auth.uid(), null);
    return old;
  end if;
  return null;
end;
$$;

-- create trigger time_events_append_only
--   after update or delete on public.time_events
--   for each row execute function public.trg_time_events_append_only();

-- Step 3: Superadmin flag on profiles (if missing) and helper function
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

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
  ), false);
$$;

-- Ensure RLS is enabled on key tables
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.time_events enable row level security;
alter table public.work_sessions enable row level security;
alter table public.absences enable row level security;
alter table public.centers enable row level security;
alter table public.teams enable row level security;

-- Add superadmin read policies (idempotent guards avoid duplication on repeated deploys)
do $$
begin
  begin
    create policy profiles_superadmin_read
      on public.profiles
      for select
      using (public.is_superadmin());
  exception when duplicate_object then null; end;

  begin
    create policy memberships_superadmin_read
      on public.memberships
      for select
      using (public.is_superadmin());
  exception when duplicate_object then null; end;

  begin
    create policy time_events_superadmin_read
      on public.time_events
      for select
      using (public.is_superadmin());
  exception when duplicate_object then null; end;

  begin
    create policy work_sessions_superadmin_read
      on public.work_sessions
      for select
      using (public.is_superadmin());
  exception when duplicate_object then null; end;

  begin
    create policy absences_superadmin_read
      on public.absences
      for select
      using (public.is_superadmin());
  exception when duplicate_object then null; end;

  begin
    create policy centers_superadmin_read
      on public.centers
      for select
      using (public.is_superadmin());
  exception when duplicate_object then null; end;

  begin
    create policy teams_superadmin_read
      on public.teams
      for select
      using (public.is_superadmin());
  exception when duplicate_object then null; end;
end;
$$;
