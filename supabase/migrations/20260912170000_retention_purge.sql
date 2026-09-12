-- =====================================================
-- Retención: borrar lo que ya no se puede conservar
-- =====================================================
-- La ley obliga a conservar el registro de jornada cuatro años. Guardar
-- más tiempo del necesario es un problema de protección de datos, así que
-- el borrado también hay que hacerlo.
--
-- Había una edge function retention-cleanup desplegada, pero su única
-- ejecución fue una simulación que escribió "Stub" en el registro y no
-- borró nada. Esto la sustituye por una purga real en la base de datos.
--
-- Hoy no hay nada que borrar: el fichaje más antiguo es de noviembre de
-- 2025. La tarea queda programada y no hará nada hasta finales de 2029.

BEGIN;

-- ─────────────────────────────────────────────────────
-- 1. La purga no debe generar histórico de cambios
-- ─────────────────────────────────────────────────────
-- Al borrar fichajes antiguos, el disparador de trazabilidad crearía una
-- fila de histórico por cada uno, justo lo contrario de lo que se busca.
-- Con la marca de sesión app.retention_purge activada, no la crea.
CREATE OR REPLACE FUNCTION public.trg_time_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('app.retention_purge', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.event_revisions(event_id, action, previous_value, new_value, reason, changed_by, hash)
    VALUES (OLD.id, 'update', to_jsonb(OLD), to_jsonb(NEW), current_setting('app.change_reason', true), auth.uid(), NULL);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.event_revisions(event_id, action, previous_value, new_value, reason, changed_by, hash)
    VALUES (OLD.id, 'delete', to_jsonb(OLD), NULL, current_setting('app.change_reason', true), auth.uid(), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────
-- 2. La purga
-- ─────────────────────────────────────────────────────
-- En simulación (por defecto) solo cuenta. Deja constancia en
-- retention_jobs de cada ejecución, cuente o borre.
CREATE OR REPLACE FUNCTION public.retention_purge(p_dry_run boolean DEFAULT true, p_years integer DEFAULT 4)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cut timestamptz := now() - make_interval(years => greatest(p_years, 1));
  v_events bigint;
  v_sessions bigint;
  v_revisions bigint;
  v_resultado jsonb;
BEGIN
  SELECT count(*) INTO v_events FROM public.time_events WHERE event_time < v_cut;
  SELECT count(*) INTO v_sessions FROM public.work_sessions WHERE clock_in_time < v_cut;
  SELECT count(*) INTO v_revisions FROM public.event_revisions WHERE changed_at < v_cut;

  IF NOT p_dry_run AND (v_events + v_sessions + v_revisions) > 0 THEN
    PERFORM set_config('app.retention_purge', 'on', true);
    DELETE FROM public.event_revisions WHERE changed_at < v_cut;
    DELETE FROM public.time_events WHERE event_time < v_cut;
    DELETE FROM public.work_sessions WHERE clock_in_time < v_cut;
    PERFORM set_config('app.retention_purge', 'off', true);
  END IF;

  v_resultado := jsonb_build_object(
    'corte', v_cut,
    'anios', greatest(p_years, 1),
    'simulacion', p_dry_run,
    'fichajes', v_events,
    'sesiones', v_sessions,
    'movimientos_historico', v_revisions
  );

  INSERT INTO public.retention_jobs(run_at, dry_run, status, deleted_count, log)
  VALUES (
    now(),
    p_dry_run,
    'done',
    CASE WHEN p_dry_run THEN 0 ELSE (v_events + v_sessions + v_revisions) END,
    v_resultado::text
  );

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.retention_purge(boolean, integer) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 3. Programación mensual
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_job int;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'retention_purge';
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
  -- Día 1 de cada mes a las 04:20
  PERFORM cron.schedule('retention_purge', '20 4 1 * *', $cron$ SELECT public.retention_purge(false, 4); $cron$);
END
$$;

COMMIT;

-- Comprobación posterior:
--   SELECT public.retention_purge(true);   -- simulación: debe contar 0 hoy
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'retention_purge';
