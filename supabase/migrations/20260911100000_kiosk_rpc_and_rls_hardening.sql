-- =====================================================
-- Kiosco por PIN: búsqueda en servidor + cierre de fugas RLS
-- =====================================================
-- Problema (2026-09-11): las pantallas de kiosco buscaban el perfil por
-- login_code y el dispositivo por PIN directamente desde el navegador con
-- la clave anónima. Para que eso funcionara existían políticas que dejaban
-- leer TODOS los perfiles con código (72 usuarios, superadmin incluido),
-- todos los dispositivos kiosco con su PIN, todas las sesiones de trabajo
-- y el registro de auditoría con los códigos en claro.
--
-- Solución: dos funciones SECURITY DEFINER que devuelven solo lo que el
-- kiosco necesita, y eliminación de las políticas públicas. La búsqueda de
-- empleado exige un PIN de dispositivo válido, así que no se pueden
-- enumerar códigos sin un PIN. Hay una pausa de 300 ms en cada fallo para
-- frenar fuerza bruta.
--
-- Orden de despliegue: 1) esta migración, 2) frontend con las pantallas
-- de kiosco nuevas. Entre 1 y 2 el kiosco por PIN antiguo dejará de
-- funcionar (las tablas ya no serán legibles). El kiosco NFC no se ve
-- afectado.

-- ─────────────────────────────────────────────────────
-- 1. Dispositivo por PIN
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_device_by_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin text := upper(trim(coalesce(p_pin, '')));
  v_dev record;
BEGIN
  IF v_pin = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_pin');
  END IF;

  SELECT d.id, d.company_id, d.name, d.center_id
    INTO v_dev
    FROM public.devices d
   WHERE d.type = 'kiosk'
     AND upper(d.secret_hash) = v_pin
   LIMIT 1;

  IF v_dev.id IS NULL THEN
    PERFORM pg_sleep(0.3);
    RETURN jsonb_build_object('ok', false, 'error', 'device_not_found');
  END IF;

  UPDATE public.devices SET last_seen_at = now() WHERE id = v_dev.id;

  RETURN jsonb_build_object(
    'ok', true,
    'device', jsonb_build_object(
      'id', v_dev.id,
      'company_id', v_dev.company_id,
      'name', v_dev.name,
      'center_id', v_dev.center_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_device_by_pin(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 2. Empleado por código, sólo con PIN de dispositivo válido
-- ─────────────────────────────────────────────────────
-- Devuelve el empleado, si pertenece a la empresa del dispositivo, y su
-- estado actual: off | on | break (calculado con la sesión activa y el
-- último evento de pausa, porque work_sessions no tiene is_on_break).
CREATE OR REPLACE FUNCTION public.kiosk_employee_by_code(p_pin text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin text := upper(trim(coalesce(p_pin, '')));
  v_code text := upper(trim(coalesce(p_code, '')));
  v_dev record;
  v_emp record;
  v_is_member boolean;
  v_session_id uuid;
  v_last_event text;
  v_status text := 'off';
BEGIN
  IF v_pin = '' OR v_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_params');
  END IF;

  SELECT d.id, d.company_id, d.name
    INTO v_dev
    FROM public.devices d
   WHERE d.type = 'kiosk' AND upper(d.secret_hash) = v_pin
   LIMIT 1;

  IF v_dev.id IS NULL THEN
    PERFORM pg_sleep(0.3);
    RETURN jsonb_build_object('ok', false, 'error', 'device_not_found');
  END IF;

  SELECT p.id, p.full_name, p.email, p.is_active
    INTO v_emp
    FROM public.profiles p
   WHERE p.login_code IS NOT NULL
     AND upper(p.login_code) = v_code
   LIMIT 1;

  IF v_emp.id IS NULL THEN
    PERFORM pg_sleep(0.3);
    RETURN jsonb_build_object('ok', false, 'error', 'code_not_found');
  END IF;

  IF v_emp.is_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'employee_inactive');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
     WHERE m.user_id = v_emp.id AND m.company_id = v_dev.company_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_member');
  END IF;

  SELECT ws.id INTO v_session_id
    FROM public.work_sessions ws
   WHERE ws.user_id = v_emp.id
     AND ws.company_id = v_dev.company_id
     AND ws.is_active = true
   ORDER BY ws.clock_in_time DESC
   LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    SELECT te.event_type INTO v_last_event
      FROM public.time_events te
     WHERE te.user_id = v_emp.id
       AND te.company_id = v_dev.company_id
     ORDER BY te.event_time DESC
     LIMIT 1;
    v_status := CASE WHEN v_last_event IN ('pause_start', 'break_start') THEN 'break' ELSE 'on' END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'device', jsonb_build_object('id', v_dev.id, 'company_id', v_dev.company_id, 'name', v_dev.name),
    'employee', jsonb_build_object('id', v_emp.id, 'full_name', v_emp.full_name, 'email', v_emp.email),
    'status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_employee_by_code(text, text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 3. Cerrar las fugas
-- ─────────────────────────────────────────────────────
-- profiles: cualquiera leía todos los perfiles con código
DROP POLICY IF EXISTS anon_profiles_login_code ON public.profiles;
DROP POLICY IF EXISTS profiles_select_by_login_code ON public.profiles;

-- work_sessions: USING (true) para el kiosco
DROP POLICY IF EXISTS anon_work_sessions_kiosk ON public.work_sessions;

-- devices: cualquiera leía los kioscos con su PIN
DROP POLICY IF EXISTS anon_kiosk_pin_select ON public.devices;
DROP POLICY IF EXISTS kiosk_read_by_pin ON public.devices;
DROP POLICY IF EXISTS kiosk_select ON public.devices;

-- audit_logs: la rama company_id IS NULL exponía los logins con código
DROP POLICY IF EXISTS "Owners and admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Owners and admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.company_id = audit_logs.company_id
         AND m.user_id = auth.uid()
         AND m.role IN ('owner', 'admin')
    )
    OR (company_id IS NULL AND actor_user_id = auth.uid())
    OR public.is_superadmin()
  );

-- Borrar los códigos ya guardados en claro en el histórico
UPDATE public.audit_logs
   SET diff = diff - 'code'
 WHERE action = 'login_with_code'
   AND diff ? 'code';

-- fastclock_points: sin RLS, legible por cualquiera
ALTER TABLE public.fastclock_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fastclock_points_company_members ON public.fastclock_points;
CREATE POLICY fastclock_points_company_members
  ON public.fastclock_points FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.company_id = fastclock_points.company_id
         AND m.user_id = auth.uid()
    )
    OR public.is_superadmin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.company_id = fastclock_points.company_id
         AND m.user_id = auth.uid()
         AND m.role IN ('owner', 'admin')
    )
    OR public.is_superadmin()
  );

-- ─────────────────────────────────────────────────────
-- 4. Verificación (debe devolver 0 filas visibles para anon)
-- ─────────────────────────────────────────────────────
-- SET ROLE anon; SELECT count(*) FROM public.profiles; SELECT count(*) FROM public.work_sessions;
-- SELECT count(*) FROM public.devices; SELECT count(*) FROM public.fastclock_points; RESET ROLE;
