-- Step 4: private bucket for legal exports
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do update set public = excluded.public;

alter table storage.objects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and polname = 'exports_service_role_manage'
  ) then
    create policy exports_service_role_manage
      on storage.objects
      for all
      using (bucket_id = 'exports' and auth.role() = 'service_role')
      with check (bucket_id = 'exports' and auth.role() = 'service_role');
  end if;
end;
$$;
