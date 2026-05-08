-- =====================================================
-- Gestión completa de bajas médicas
-- =====================================================
-- 1. Bloqueo automático de fichaje cuando hay baja aprobada activa
-- 2. Categoría 'sick_leave_certificate' en employee_documents
-- 3. Vista helper 'workers_on_sick_leave' para el dashboard

-- ─────────────────────────────────────────────────────
-- 1. Categoría nueva en employee_documents
-- ─────────────────────────────────────────────────────
ALTER TABLE public.employee_documents
  DROP CONSTRAINT IF EXISTS employee_documents_category_check;

ALTER TABLE public.employee_documents
  ADD CONSTRAINT employee_documents_category_check CHECK (category IN (
    'contract',
    'addendum',
    'training',
    'medical',
    'sick_leave_certificate',  -- NUEVO
    'prl',
    'rgpd',
    'id_document',
    'other'
  ));

-- ─────────────────────────────────────────────────────
-- 2. Helper: ¿está este trabajador de baja médica HOY?
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_user_on_sick_leave (
  p_user_id UUID,
  p_company_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.absences
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND status = 'approved'
      AND absence_type = 'sick_leave'
      AND p_date BETWEEN start_date AND end_date
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_on_sick_leave(UUID, UUID, DATE) TO anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 3. Modificar nfc_kiosk_clock para bloquear si está de baja
-- ─────────────────────────────────────────────────────
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
  v_has_session boolean;
  v_session_id uuid;
  v_next text;
  v_now timestamptz;
  v_today date;
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

  -- Calcular reverse-byte UID
  v_reversed := '';
  IF length(v_norm) % 2 = 0 THEN
    FOR n IN REVERSE (length(v_norm) / 2)..1 LOOP
      v_reversed := v_reversed || substring(v_norm FROM (n * 2 - 1) FOR 2);
    END LOOP;
  ELSE
    v_reversed := v_norm;
  END IF;

  v_emp := NULL; v_name := NULL; v_ok := false;

  -- Buscar tarjeta (directa)
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

  -- Búsqueda por empleado_id (legacy)
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

  -- ⚠️ BLOQUEO POR BAJA MÉDICA APROBADA ⚠️
  IF public.is_user_on_sick_leave(v_emp, p_company_id, v_today) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'on_sick_leave',
      'nombre_completo', v_name,
      'message', 'Estás en periodo de baja médica aprobada. Si has vuelto antes de tiempo, avisa a tu responsable para cerrar la baja.'
    );
  END IF;

  -- Decidir entrada o salida
  SELECT ws.id INTO v_session_id
  FROM public.work_sessions ws
  WHERE ws.user_id = v_emp AND ws.company_id = p_company_id AND ws.is_active = true
  ORDER BY ws.clock_in_time DESC LIMIT 1;

  v_has_session := v_session_id IS NOT NULL;

  IF v_has_session THEN
    v_next := 'clock_out';
    UPDATE public.work_sessions SET clock_out_time = v_now, is_active = false,
      total_hours = EXTRACT(EPOCH FROM (v_now - clock_in_time)) / 3600.0
    WHERE id = v_session_id;
    INSERT INTO public.time_events (user_id, company_id, event_type, event_time, source)
    VALUES (v_emp, p_company_id, 'clock_out', v_now, 'nfc');
  ELSE
    v_next := 'clock_in';
    INSERT INTO public.work_sessions (user_id, company_id, clock_in_time, is_active, source)
    VALUES (v_emp, p_company_id, v_now, true, 'nfc');
    INSERT INTO public.time_events (user_id, company_id, event_type, event_time, source)
    VALUES (v_emp, p_company_id, 'clock_in', v_now, 'nfc');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', v_next, 'nombre_completo', v_name, 'event_time', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.nfc_kiosk_clock(uuid, text, timestamptz) TO anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 4. Vista útil para el dashboard: trabajadores de baja HOY
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.workers_on_sick_leave_today AS
SELECT
  a.user_id,
  a.company_id,
  a.start_date,
  a.end_date,
  (a.end_date - CURRENT_DATE)::int AS days_remaining,
  (CURRENT_DATE - a.start_date)::int AS days_elapsed,
  a.reason,
  p.full_name,
  p.email
FROM public.absences a
JOIN public.profiles p ON p.id = a.user_id
WHERE a.status = 'approved'
  AND a.absence_type = 'sick_leave'
  AND CURRENT_DATE BETWEEN a.start_date AND a.end_date;

GRANT SELECT ON public.workers_on_sick_leave_today TO authenticated;
