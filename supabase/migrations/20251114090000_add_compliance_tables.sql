-- Tables to support legal compliance workflows

-- Audit trail of modifications on time events
create table if not exists public.event_revisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  action text not null check (action in ('update','delete')),
  previous_value jsonb,
  new_value jsonb,
  reason text,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  hash text
);
comment on table public.event_revisions is 'Histórico append-only de cambios sobre time_events';

-- Monthly sign-off records per employee/company
create table if not exists public.monthly_signoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  center_id uuid,
  user_id uuid not null,
  year int not null,
  month int not null check (month between 1 and 12),
  status text not null default 'pending' check (status in ('pending','signed','disputed')),
  signed_at timestamptz,
  summary_hash text,
  signature jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, user_id, year, month)
);

-- Consent tracking for privacy/usage agreements
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  consent_type text not null,
  text_version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb
);

-- Data-retention cleanup job log
create table if not exists public.retention_jobs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  dry_run boolean not null default true,
  status text not null default 'done' check (status in ('done','failed')),
  deleted_count int not null default 0,
  log text
);
