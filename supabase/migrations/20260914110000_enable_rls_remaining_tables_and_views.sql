-- =====================================================
-- Activar la seguridad por filas donde faltaba (tablas y vistas)
-- =====================================================
-- Detectado 2026-09-12 al verificar la migración anterior: diez tablas
-- tenían la seguridad por filas DESACTIVADA, así que sus políticas (si las
-- había) ni se aplicaban, y la clave pública de la web conservaba permiso
-- directo de lectura, inserción, modificación y borrado.
--
-- Lo más grave:
--   - auth_codes: códigos de autenticación legibles y creables por cualquiera.
--   - event_revisions: 11.114 filas del histórico de cambios de fichajes,
--     modificables y borrables. Es la prueba de que el registro de jornada
--     no se ha manipulado.
--   - login_code_requests: emails, IP y navegador de quien pide un código.
--   - reports_sanitized y workers_on_sick_leave_today: las dos vistas se
--     ejecutaban con permisos del propietario, saltándose la seguridad de
--     las tablas de debajo. La de bajas médicas expone datos de salud.
--
-- Ninguna pantalla del navegador usa esas tablas salvo
-- company_compliance_settings (ajustes de la empresa) y la vista de bajas.
-- Las edge functions escriben con service role, que no se ve afectado.
--
-- Todo en una transacción: si algo falla, no se aplica nada.

BEGIN;

-- ─────────────────────────────────────────────────────
-- 1. Activar la seguridad por filas
-- ─────────────────────────────────────────────────────
ALTER TABLE public.auth_codes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_in_reminders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_points                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_compliance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_revisions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_code_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_signoffs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trabajadores_rows           ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────
-- 2. Disparadores de time_events
-- ─────────────────────────────────────────────────────
-- time_events_append_only escribe en event_revisions y trg_update_last_clock
-- en clock_points. Se ejecutan con los permisos de quien edita el fichaje,
-- así que al activar la seguridad por filas un responsable ya no podría
-- corregir fichajes. Pasan a ejecutarse con permisos del propietario.
ALTER FUNCTION public.trg_time_events_append_only() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_clock_point_last_clock() SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────
-- 3. Retirar el acceso directo a las tablas internas
-- ─────────────────────────────────────────────────────
-- Ninguna pantalla las usa: solo las tocan funciones del servidor.
REVOKE ALL ON TABLE
  public.auth_codes,
  public.clock_in_reminders,
  public.clock_points,
  public.consents,
  public.event_revisions,
  public.login_code_requests,
  public.monthly_signoffs,
  public.retention_jobs,
  public.trabajadores_rows
FROM anon, authenticated;

-- Ajustes de cumplimiento: la pantalla de ajustes sí los usa, con sesión.
-- Las políticas de la migración anterior filtran por empresa y rol.
REVOKE ALL ON TABLE public.company_compliance_settings FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.company_compliance_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.company_compliance_settings TO authenticated;

-- ─────────────────────────────────────────────────────
-- 4. Vistas con permisos del propietario
-- ─────────────────────────────────────────────────────
-- security_invoker = true hace que la vista respete la seguridad por filas
-- de quien consulta, no la del propietario.
ALTER VIEW public.workers_on_sick_leave_today SET (security_invoker = true);
ALTER VIEW public.reports_sanitized           SET (security_invoker = true);

REVOKE ALL ON TABLE public.workers_on_sick_leave_today FROM anon, authenticated;
REVOKE ALL ON TABLE public.reports_sanitized           FROM anon, authenticated;
GRANT SELECT ON TABLE public.workers_on_sick_leave_today TO authenticated;
GRANT SELECT ON TABLE public.reports_sanitized           TO authenticated;

COMMIT;

-- Comprobación posterior (debe devolver 0 filas):
--   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relkind='r' and c.relrowsecurity = false;
