-- Permitir configurar si se bloquean fichajes fuera de horario
alter table public.company_compliance_settings
add column if not exists allow_outside_schedule boolean not null default true;

comment on column public.company_compliance_settings.allow_outside_schedule
is 'Si es true, se permite fichar fuera del horario configurado; si es false, se bloquea.';
