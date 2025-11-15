create table if not exists public.login_code_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  requested_at timestamptz not null default timezone('utc', now()),
  ip text,
  user_agent text
);

create index if not exists login_code_requests_profile_idx
  on public.login_code_requests (profile_id, requested_at desc);
