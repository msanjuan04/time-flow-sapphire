-- Tabla de puntos FastClock para geovalla por tag/punto
create table if not exists public.fastclock_points (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters numeric not null default 200,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

-- Trigger updated_at
drop trigger if exists trg_fastclock_points_updated_at on public.fastclock_points;
create trigger trg_fastclock_points_updated_at
before update on public.fastclock_points
for each row execute function public.set_updated_at();

-- Índices
create index if not exists idx_fastclock_points_company on public.fastclock_points(company_id);

-- Relacionar devices con punto
alter table public.worker_devices
  add column if not exists point_id uuid references public.fastclock_points(id) on delete set null;

create index if not exists idx_worker_devices_point_id on public.worker_devices(point_id);

