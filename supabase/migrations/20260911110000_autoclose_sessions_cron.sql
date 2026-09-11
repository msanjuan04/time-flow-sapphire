-- =====================================================
-- Auto-cierre programado de turnos olvidados
-- =====================================================
-- Detectado 2026-09-11: la edge function admin-autoclose-sessions existe
-- desde noviembre de 2025 pero nada la ejecuta (no hay pg_cron en el
-- proyecto y requiere un JWT de superadmin). Un trabajador que olvida
-- fichar la salida deja el turno abierto hasta que alguien lo corrige.
--
-- Esta migración lo resuelve dentro de Postgres, sin claves ni HTTP:
--   1. Función autoclose_stale_sessions(): cierra sesiones activas que
--      superan companies.max_shift_hours (16 h si no está configurado),
--      con status='auto_closed' y review_status='exceeded_limit', igual que
--      hacen la edge function clock y nfc_kiosk_clock.
--   2. pg_cron la ejecuta cada 30 minutos.
--
-- Idempotente. Requiere permisos para crear extensiones (rol postgres).

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.autoclose_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed integer := 0;
BEGIN
  WITH candidates AS (
    SELECT ws.id,
           ws.clock_in_time,
           COALESCE(NULLIF(c.max_shift_hours, 0), 16)::numeric AS max_hours
      FROM public.work_sessions ws
      JOIN public.companies c ON c.id = ws.company_id
     WHERE ws.is_active = true
       AND ws.clock_out_time IS NULL
       AND now() - ws.clock_in_time > make_interval(secs => COALESCE(NULLIF(c.max_shift_hours, 0), 16) * 3600)
  ),
  closed AS (
    UPDATE public.work_sessions ws
       SET clock_out_time = cand.clock_in_time + make_interval(secs => cand.max_hours * 3600),
           is_active = false,
           status = 'auto_closed',
           review_status = 'exceeded_limit',
           total_hours = cand.max_hours,
           updated_at = now()
      FROM candidates cand
     WHERE ws.id = cand.id
     RETURNING ws.id
  )
  SELECT count(*) INTO v_closed FROM closed;

  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.autoclose_stale_sessions() FROM public, anon, authenticated;

-- Programar cada 30 minutos (sustituye el job si ya existe)
DO $$
DECLARE
  v_job int;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'autoclose_stale_sessions';
  IF v_job IS NOT NULL THEN
    PERFORM cron.unschedule(v_job);
  END IF;
  PERFORM cron.schedule(
    'autoclose_stale_sessions',
    '*/30 * * * *',
    $cron$ SELECT public.autoclose_stale_sessions(); $cron$
  );
END
$$;

-- Comprobación:
--   SELECT jobname, schedule, active FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
