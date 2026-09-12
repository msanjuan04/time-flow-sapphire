-- =====================================================
-- Avisos en el móvil: suscripciones y recordatorios de turno
-- =====================================================
-- Los recordatorios de fichaje solo existían por email, y la función que
-- los enviaba consultaba una tabla, worker_schedules, que no existe en esta
-- base de datos: lleva desde diciembre de 2025 fallando cada cinco minutos
-- sin enviar nada. Se sustituye por shift-reminders, que usa los horarios
-- reales (scheduled_hours) y avisa al móvil.
--
-- Un aviso de "no has fichado la salida" al acabar el turno evita la mayor
-- parte de las correcciones manuales, que es el trabajo que más carga al
-- responsable.

BEGIN;

-- ─────────────────────────────────────────────────────
-- 1. Suscripciones de cada dispositivo
-- ─────────────────────────────────────────────────────
-- Una fila por navegador o móvil que ha aceptado recibir avisos. Solo la
-- escribe la edge function push-register con service role; nadie más tiene
-- acceso, porque el endpoint es la dirección a la que se envían los avisos.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 2. Registro de avisos enviados
-- ─────────────────────────────────────────────────────
-- La tarea corre cada cinco minutos: esto evita repetir el mismo aviso a la
-- misma persona el mismo día.
CREATE TABLE IF NOT EXISTS public.shift_reminders_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('missing_clock_in', 'missing_clock_out')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, kind)
);

ALTER TABLE public.shift_reminders_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shift_reminders_log FROM anon, authenticated;

-- Los avisos enviados no hacen falta más de tres meses.
CREATE OR REPLACE FUNCTION public.purge_shift_reminders_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH borradas AS (
    DELETE FROM public.shift_reminders_log WHERE sent_at < now() - INTERVAL '90 days' RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM borradas;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_shift_reminders_log() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 3. Programación
-- ─────────────────────────────────────────────────────
-- Se sustituye la tarea del recordatorio roto por la nueva función.
-- IMPORTANTE: reemplaza <ANON_KEY> por la clave pública del proyecto antes
-- de ejecutar (la misma que usa la web, VITE_SUPABASE_ANON_KEY).
DO $$
DECLARE
  v_job int;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'clock_in_reminders';
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;

  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'shift_reminders';
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;

  PERFORM cron.schedule(
    'shift_reminders',
    '*/5 * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://fyyhkdishlythkdnojdh.supabase.co/functions/v1/shift-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', '<ANON_KEY>',
          'Authorization', 'Bearer <ANON_KEY>'
        ),
        body := '{}'::jsonb
      );
    $cron$
  );

  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'purge_shift_reminders_log';
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
  PERFORM cron.schedule('purge_shift_reminders_log', '35 4 * * 1', $cron$ SELECT public.purge_shift_reminders_log(); $cron$);
END
$$;

COMMIT;

-- Comprobación posterior:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--   SELECT count(*) FROM public.push_subscriptions;
