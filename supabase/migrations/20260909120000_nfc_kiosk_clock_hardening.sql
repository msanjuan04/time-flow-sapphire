-- =====================================================
-- nfc_kiosk_clock: endurecimiento para producción
-- =====================================================
-- Problemas que corrige (detectados 2026-09-09 revisando Santa Marta):
--
-- 1. Al cerrar por NFC no se ponía status='closed'. Las sesiones cerradas
--    por tarjeta quedaban con status='open' y is_active=false, así que
--    admin-autoclose-sessions (filtra por status='open') las volvía a tocar
--    y cualquier listado por status las mostraba como abiertas.
--
-- 2. No había auto-cierre. Un turno olvidado (p.ej. abierto el 22/05) se
--    cerraba con la SIGUIENTE pasada de tarjeta, meses después, con miles
--    de horas, y esa pasada contaba como SALIDA en vez de ENTRADA.
--    Ahora: si la sesión activa supera companies.max_shift_hours (o 16 h
--    si no está configurado) se auto-cierra con status='auto_closed'
--    (review_status='exceeded_limit' si la columna existe) y la pasada
--    abre un turno nuevo.
--
-- 3. La versión de 20260508 llamaba a is_user_on_sick_leave, que no está
--    en producción. Aquí la llamada está protegida: sólo se ejecuta si la
--    función existe.
--
-- Mantiene: normalización del UID, coincidencia con bytes invertidos,
-- búsqueda legacy por empleado_id, ventana de p_event_time [-7d, +1min].
-- Idempotente (CREATE OR REPLACE). Firma sin cambios.

CREATE OR REPLACE FUNCTION public.nfc_kiosk_clock (
  p_company_id uuid,
  p_raw_uid text,
  p_event_time timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_reversed text;
  v_emp uuid;
  v_name text;
  v_ok boolean;
  v_session_id uuid;
  v_session_in timestamptz;
  v_next text;
  v_now timestamptz;
  v_today date;
  v_on_leave boolean := false;
  v_max_hours numeric;
  v_auto_closed boolean := false;
  v_has_review_status boolean;
  n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_not_found');
  END IF;

  v_now := COALESCE(p_event_time, now());
  IF v_now > now() + INTERVAL '1 minute' THEN v_now := now(); END IF;
  IF v_now < now() - INTERVAL '7 days' THEN v_now := now() - INTERVAL '7 days'; END IF;
  v_today := v_now::date;

  v_norm := lower(regexp_replace(coalesce(trim(p_raw_uid), ''), '[^a-zA-Z0-9]', '', 'g'));
  IF v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_uid');
  END IF;

  -- UID con bytes invertidos (algunos lectores USB los entregan al revés)
  v_reversed := '';
  IF length(v_norm) % 2 = 0 THEN
    FOR n IN REVERSE (length(v_norm) / 2)..1 LOOP
      v_reversed := v_reversed || substring(v_norm FROM (n * 2 - 1) FOR 2);
    END LOOP;
  ELSE
    v_reversed := v_norm;
  END IF;

  v_emp := NULL; v_name := NULL; v_ok := false;

  -- Tarjeta asociada directamente a la empresa
  SELECT nc.user_id,
    coalesce(nullif(trim(tr.nombre_completo), ''), p.full_name, 'Trabajador'),
    (p.is_active IS DISTINCT FROM false) AND (tr.id IS NULL OR tr.activo IS DISTINCT FROM false)
  INTO v_emp, v_name, v_ok
  FROM public.nfc_cards nc
  JOIN public.profiles p ON p.id = nc.user_id
  LEFT JOIN public.trabajadores_rows tr ON tr.id = nc.user_id AND tr.company_id = p_company_id
  WHERE nc.company_id = p_company_id
    AND lower(regexp_replace(coalesce(
          nullif(trim(nc.uid), ''),
          nullif(trim(nc.card_uid), ''),
          nullif(trim(nc.card_uid_normalized), ''), ''
        ), '[^a-zA-Z0-9]', '', 'g')) IN (v_norm, v_reversed)
    AND (nc.active IS NULL OR nc.active = true)
  LIMIT 1;

  -- Esquema legacy por empleado_id
  IF v_emp IS NULL THEN
    SELECT nc.empleado_id,
      coalesce(nullif(trim(tr.nombre_completo), ''), p.full_name, 'Trabajador'),
      (tr.activo IS DISTINCT FROM false) AND (p.is_active IS DISTINCT FROM false)
    INTO v_emp, v_name, v_ok
    FROM public.nfc_cards nc
    JOIN public.trabajadores_rows tr ON tr.id = nc.empleado_id AND tr.company_id = p_company_id
    JOIN public.profiles p ON p.id = nc.empleado_id
    WHERE lower(regexp_replace(coalesce(
            nullif(trim(nc.uid), ''),
            nullif(trim(nc.card_uid), ''),
            nullif(trim(nc.card_uid_normalized), ''), ''
          ), '[^a-zA-Z0-9]', '', 'g')) IN (v_norm, v_reversed)
      AND nc.empleado_id IS NOT NULL
      AND (nc.active IS NULL OR nc.active = true)
    LIMIT 1;
  END IF;

  IF v_emp IS NULL OR v_ok IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_card');
  END IF;

  -- Bloqueo por baja médica, sólo si el helper está desplegado
  IF to_regprocedure('public.is_user_on_sick_leave(uuid, uuid, date)') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_user_on_sick_leave($1, $2, $3)'
      INTO v_on_leave USING v_emp, p_company_id, v_today;
    IF v_on_leave THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'on_sick_leave',
        'nombre_completo', v_name,
        'message', 'Estás en periodo de baja médica aprobada. Si has vuelto antes de tiempo, avisa a tu responsable para cerrar la baja.'
      );
    END IF;
  END IF;

  -- Sesión activa del trabajador en esta empresa
  SELECT ws.id, ws.clock_in_time INTO v_session_id, v_session_in
  FROM public.work_sessions ws
  WHERE ws.user_id = v_emp AND ws.company_id = p_company_id AND ws.is_active = true
  ORDER BY ws.clock_in_time DESC LIMIT 1;

  -- Auto-cierre de turnos zombis (misma regla que la edge function clock)
  IF v_session_id IS NOT NULL THEN
    v_max_hours := NULL;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'max_shift_hours'
    ) THEN
      EXECUTE 'SELECT max_shift_hours FROM public.companies WHERE id = $1'
        INTO v_max_hours USING p_company_id;
    END IF;
    IF v_max_hours IS NULL OR v_max_hours <= 0 THEN v_max_hours := 16; END IF;

    IF v_now - v_session_in > make_interval(secs => v_max_hours * 3600) THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_sessions' AND column_name = 'review_status'
      ) INTO v_has_review_status;

      IF v_has_review_status THEN
        EXECUTE 'UPDATE public.work_sessions
                    SET clock_out_time = $1,
                        is_active = false,
                        status = ''auto_closed'',
                        review_status = ''exceeded_limit'',
                        total_hours = $2
                  WHERE id = $3'
          USING v_session_in + make_interval(secs => v_max_hours * 3600), v_max_hours, v_session_id;
      ELSE
        UPDATE public.work_sessions
           SET clock_out_time = v_session_in + make_interval(secs => v_max_hours * 3600),
               is_active = false,
               status = 'auto_closed',
               total_hours = v_max_hours
         WHERE id = v_session_id;
      END IF;

      v_auto_closed := true;
      v_session_id := NULL;
    END IF;
  END IF;

  IF v_session_id IS NOT NULL THEN
    v_next := 'clock_out';
    UPDATE public.work_sessions
       SET clock_out_time = v_now,
           is_active = false,
           status = 'closed',
           total_hours = EXTRACT(EPOCH FROM (v_now - clock_in_time)) / 3600.0
     WHERE id = v_session_id;
    INSERT INTO public.time_events (user_id, company_id, event_type, event_time, source)
    VALUES (v_emp, p_company_id, 'clock_out', v_now, 'nfc');
  ELSE
    v_next := 'clock_in';
    INSERT INTO public.work_sessions (user_id, company_id, clock_in_time, is_active, status, source)
    VALUES (v_emp, p_company_id, v_now, true, 'open', 'nfc');
    INSERT INTO public.time_events (user_id, company_id, event_type, event_time, source)
    VALUES (v_emp, p_company_id, 'clock_in', v_now, 'nfc');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'action', v_next,
    'nombre_completo', v_name,
    'event_time', v_now,
    'auto_closed_previous', v_auto_closed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nfc_kiosk_clock(uuid, text, timestamptz) TO anon, authenticated;

-- Reparar sesiones NFC ya cerradas que quedaron con status='open'
UPDATE public.work_sessions
   SET status = 'closed'
 WHERE source = 'nfc'
   AND is_active = false
   AND clock_out_time IS NOT NULL
   AND status = 'open';
