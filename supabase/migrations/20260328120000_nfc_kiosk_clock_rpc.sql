-- Kiosk NFC por empresa: RPC público (anon) que valida tarjeta y registra time_events con source = nfc

ALTER TABLE public.time_events
  DROP CONSTRAINT IF EXISTS time_events_source_check;

ALTER TABLE public.time_events
  ADD CONSTRAINT time_events_source_check
  CHECK (
    source IS NULL
    OR source IN ('mobile', 'web', 'kiosk', 'fastclock', 'nfc')
  );

-- Esquema pedido: empleados lógicos por empresa (id = profiles.id)
CREATE TABLE IF NOT EXISTS public.trabajadores_rows (
  id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  numero_logico integer,
  nombre_completo text,
  activo boolean NOT NULL DEFAULT true,
  PRIMARY KEY (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_trabajadores_rows_company ON public.trabajadores_rows (company_id);

-- Columnas opcionales en nfc_cards (solo si la tabla ya existe en el proyecto)
DO $$
BEGIN
  IF to_regclass ('public.nfc_cards') IS NOT NULL THEN
    ALTER TABLE public.nfc_cards
      ADD COLUMN IF NOT EXISTS uid text;

    ALTER TABLE public.nfc_cards
      ADD COLUMN IF NOT EXISTS empleado_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.nfc_kiosk_clock (p_company_id uuid, p_raw_uid text)
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
  v_next public.event_type;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_not_found');
  END IF;

  v_norm :=
    lower(
      regexp_replace(
        coalesce(trim(p_raw_uid), ''),
        '[^a-zA-Z0-9]',
        '',
        'g'
      )
    );

  IF v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_uid');
  END IF;

  v_emp := NULL;
  v_name := NULL;
  v_ok := false;

  -- 1) Tarjetas con company_id (panel actual): user_id + card_uid / uid
  SELECT
    nc.user_id,
    coalesce(nullif(trim(tr.nombre_completo), ''), p.full_name, 'Trabajador'),
    (p.is_active IS NOT FALSE)
    AND (tr.id IS NULL OR tr.activo = true)
  INTO v_emp, v_name, v_ok
  FROM public.nfc_cards nc
  JOIN public.profiles p ON p.id = nc.user_id
  LEFT JOIN public.trabajadores_rows tr
    ON tr.id = nc.user_id
   AND tr.company_id = p_company_id
  WHERE nc.company_id = p_company_id
    AND (
      lower(regexp_replace(coalesce(nc.uid, nc.card_uid, ''), '[^a-zA-Z0-9]', '', 'g')) = v_norm
    )
    AND (nc.active IS NULL OR nc.active = true)
  LIMIT 1;

  -- 2) Esquema uid + empleado_id enlazado a trabajadores_rows de esa empresa
  IF v_emp IS NULL THEN
    SELECT
      nc.empleado_id,
      coalesce(nullif(trim(tr.nombre_completo), ''), p.full_name, 'Trabajador'),
      tr.activo = true
      AND (p.is_active IS NOT FALSE)
    INTO v_emp, v_name, v_ok
    FROM public.nfc_cards nc
    JOIN public.trabajadores_rows tr
      ON tr.id = nc.empleado_id
     AND tr.company_id = p_company_id
    JOIN public.profiles p ON p.id = nc.empleado_id
    WHERE lower(regexp_replace(coalesce(nc.uid, nc.card_uid, ''), '[^a-zA-Z0-9]', '', 'g')) = v_norm
      AND nc.empleado_id IS NOT NULL
      AND (nc.active IS NULL OR nc.active = true)
    LIMIT 1;
  END IF;

  IF v_emp IS NULL OR v_ok IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_card');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.work_sessions ws
    WHERE ws.user_id = v_emp
      AND ws.company_id = p_company_id
      AND ws.is_active = true
  )
  INTO v_has_session;

  IF v_has_session THEN
    v_next := 'clock_out';
  ELSE
    v_next := 'clock_in';
  END IF;

  INSERT INTO public.time_events (
    user_id,
    company_id,
    event_type,
    event_time,
    source,
    meta
  )
  VALUES (
    v_emp,
    p_company_id,
    v_next,
    now(),
    'nfc',
    jsonb_build_object('tipo', 'nfc', 'card_uid', v_norm)
  );

  RETURN jsonb_build_object(
    'ok',
    true,
    'nombre_completo',
    v_name,
    'event_type',
    v_next::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.nfc_kiosk_clock (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nfc_kiosk_clock (uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.nfc_kiosk_clock (uuid, text) TO authenticated;
