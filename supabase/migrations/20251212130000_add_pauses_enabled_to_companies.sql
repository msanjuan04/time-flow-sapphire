-- Habilitar/deshabilitar pausas a nivel de empresa
alter table public.companies
  add column if not exists pauses_enabled boolean not null default true;

