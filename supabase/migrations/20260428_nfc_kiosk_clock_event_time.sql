-- =====================================================
-- nfc_kiosk_clock: añadir parámetro opcional p_event_time
-- =====================================================
-- Permite que la cola offline registre eventos con la
-- marca de tiempo REAL en que el trabajador acercó la
-- tarjeta, no la del momento de la sincronización.
--
-- Si p_event_time es NULL o no se pasa → comportamiento
-- igual que antes (now()).
--
-- Idempotente: usa CREATE OR REPLACE.

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
  v_emp uuid;
  v_name text;
  v_ok boolean;
  v_has_session boolean;
  v_session_id uuid;
  v_next text;
  v_now timestamptz;
BEGIN
  -- Validación empresa
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_not_found');
  END IF;

  -- Tiempo del evento: si viene del cliente lo usamos, si no, ahora.
  -- Limitamos al rango [hace 7 días .. ahora + 1 minuto] para evitar abusos
  -- por relojes mal configurados.
  v_now := COALESCE(p_event_time, now());
  IF v_now > now() + INTERVAL '1 minute' THEN
    v_now := now();
  END IF;
  IF v_now < now() - INTERVAL '7 days' THEN
    v_now := now() - INTERVAL '7 days';
  END IF;

  -- Normalización del UID (alfanumérico, lowercase)
  v_norm := lower(regexp_replace(coalesce(trim(p_raw_uid), ''), '[^a-zA-Z0-9]', '', 'g'));

  IF v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_uid');
  END IF;

  v_emp := NULL;
  v_name := NULL;
  v_ok := false;

  -- 1) nfc_cards con company_id directo (panel actual): user_id + uid
  SELECT
    nc.user_id,
    coalesce(nullif(trim(tr.nombre_completo), ''), p.full_name, 'Trabajador'),
    (p.is_active IS DISTINCT FROM false)
    AND (tr.id IS NULL OR tr.activo IS DISTINCT FROM false)
  INTO v_emp, v_name, v_ok
  FROM public.nfc_cards nc
  JOIN public.profiles p ON p.id = nc.user_id
  LEFT JOIN public.trabajadores_rows tr
    ON tr.id = nc.user_id
   AND tr.company_id = p_company_id
  WHERE nc.company_id = p_company_id
    AND (
      lower(regexp_replace(
        coalesce(
          nullif(trim(nc.uid), ''),
          nullif(trim(nc.card_uid), ''),
          nullif(trim(nc.card_uid_normalized), ''),
          ''
        ),
        '[^a-zA-Z0-9]', '', 'g'
      )) = v_norm
    )
    AND (nc.active IS NULL OR nc.active = true)
  LIMIT 1;

  -- 2) Esquema con empleado_id
  IF v_emp IS NULL THEN
    SELECT
      nc.empleado_id,
      coalesce(nullif(trim(tr.nombre_completo), ''), p.full_name, 'Trabajador'),
      (tr.activo IS DISTINCT FROM false)
      AND (p.is_active IS DISTINCT FROM false)
    INTO v_emp, v_name, v_ok
    FROM public.nfc_cards nc
    JOIN public.trabajadores_rows tr
      ON tr.id = nc.empleado_id
     AND tr.company_id = p_company_id
    JOIN public.profiles p ON p.id = nc.empleado_id
    WHERE lower(regexp_replace(
        coalesce(
          nullif(trim(nc.uid), ''),
          nullif(trim(nc.card_uid), ''),
          nullif(trim(nc.card_uid_normalized), ''),
          ''
        ),
        '[^a-zA-Z0-9]', '', 'g'
      )) = v_norm
      AND nc.empleado_id IS NOT NULL
      AND (nc.active IS NULL OR nc.active = true)
    LIMIT 1;
  END IF;

  IF v_emp IS NULL OR v_ok IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_card');
  END IF;

  -- Decidir entrada o salida según sesión activa
  SELECT ws.id
  INTO v_session_id
  FROM public.work_sessions ws
  WHERE ws.user_id = v_emp
    AND ws.company_id = p_company_id
    AND ws.is_active = true
  ORDER BY ws.clock_in_time DESC
  LIMIT 1;

  v_has_session := v_session_id IS NOT NULL;

  IF v_has_session THEN
    -- SALIDA: cierra la sesión activa
    v_next := 'clock_out';

    UPDATE public.work_sessions
       SET clock_out_time = v_now,
           is_active = false,
           total_hours = EXTRACT(EPOCH FROM (v_now - clock_in_time)) / 3600.0
     WHERE id = v_session_id;

    INSERT INTO public.time_events (user_id, company_id, event_type, event_time, source)
    VALUES (v_emp, p_company_id, 'clock_out', v_now, 'nfc');
  ELSE
    -- ENTRADA: abre nueva sesión
    v_next := 'clock_in';

    INSERT INTO public.work_sessions (user_id, company_id, clock_in_time, is_active, source)
    VALUES (v_emp, p_company_id, v_now, true, 'nfc');

    INSERT INTO public.time_events (user_id, company_id, event_type, event_time, source)
    VALUES (v_emp, p_company_id, 'clock_in', v_now, 'nfc');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'action', v_next,
    'nombre_completo', v_name,
    'event_time', v_now
  );
END;
$$;

-- Asegurar permisos para el cliente público (kioskos sin login)
GRANT EXECUTE ON FUNCTION public.nfc_kiosk_clock(uuid, text, timestamptz) TO anon, authenticated;
