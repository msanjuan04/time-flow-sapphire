-- =====================================================
-- Límite de intentos en el login por código
-- =====================================================
-- Detectado 2026-09-12: login-with-code no limitaba los intentos. El código
-- es de 6 dígitos y es la única credencial; con 72 códigos en uso, probar al
-- azar acierta uno de cada ~14.000 intentos. Automatizarlo es trivial.
--
-- Esta tabla guarda los intentos recientes. El código NO se guarda: solo su
-- hash SHA-256, para poder frenar la fuerza bruta contra un código concreto
-- sin almacenar la credencial. Solo la escribe la edge function (service
-- role); nadie más tiene acceso.

BEGIN;

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  code_hash text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_code ON public.login_attempts (code_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON public.login_attempts (created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.login_attempts FROM anon, authenticated;

-- Purga diaria: no hace falta conservar los intentos más de una semana.
CREATE OR REPLACE FUNCTION public.purge_login_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH borradas AS (
    DELETE FROM public.login_attempts WHERE created_at < now() - INTERVAL '7 days' RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM borradas;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_login_attempts() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_job int;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'purge_login_attempts';
  IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF;
  PERFORM cron.schedule('purge_login_attempts', '17 3 * * *', $cron$ SELECT public.purge_login_attempts(); $cron$);
END
$$;

COMMIT;
