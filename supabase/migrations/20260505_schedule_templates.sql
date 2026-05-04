-- =====================================================
-- Plantillas de horario reutilizables
-- =====================================================
-- El owner crea plantillas (turno mañana, turno tarde…) y las aplica
-- a empleados o equipos completos en un rango de fechas. Genera
-- automáticamente las filas correspondientes en scheduled_hours.

CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Configuración por día de la semana (clave en inglés para que coincida con
  -- toLocaleDateString en el cliente). Cada valor null = día no laborable.
  -- Estructura por día:
  --   { "start": "HH:MM", "end": "HH:MM",
  --     "morning_end": "HH:MM" | null,
  --     "afternoon_start": "HH:MM" | null,
  --     "expected_hours": number | null }
  monday    JSONB,
  tuesday   JSONB,
  wednesday JSONB,
  thursday  JSONB,
  friday    JSONB,
  saturday  JSONB,
  sunday    JSONB,

  /* Opciones de aplicación */
  skip_holidays BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_company
  ON public.schedule_templates (company_id);

ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_templates_read ON public.schedule_templates;
CREATE POLICY schedule_templates_read ON public.schedule_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = schedule_templates.company_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS schedule_templates_write ON public.schedule_templates;
CREATE POLICY schedule_templates_write ON public.schedule_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = schedule_templates.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = schedule_templates.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'manager')
    )
  );

-- =====================================================
-- RPC: aplicar una plantilla a un conjunto de usuarios
-- en un rango de fechas. Hace upsert en scheduled_hours.
-- Devuelve el número de filas creadas/actualizadas.
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_schedule_template (
  p_template_id UUID,
  p_user_ids UUID[],
  p_start_date DATE,
  p_end_date DATE,
  p_overwrite BOOLEAN DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template public.schedule_templates%ROWTYPE;
  v_company_id UUID;
  v_actor UUID := auth.uid();
  v_user UUID;
  v_day DATE;
  v_dow INT;
  v_day_cfg JSONB;
  v_start TEXT;
  v_end TEXT;
  v_morning_end TEXT;
  v_afternoon_start TEXT;
  v_hours NUMERIC;
  v_holiday_dates DATE[];
  v_count INT := 0;
  v_skipped INT := 0;
BEGIN
  /* 1. Cargar plantilla y validar */
  SELECT * INTO v_template FROM public.schedule_templates WHERE id = p_template_id;
  IF v_template.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'template_not_found');
  END IF;

  v_company_id := v_template.company_id;

  /* 2. Comprobar permisos del actor (owner/admin/manager de esa empresa) */
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = v_company_id
      AND m.user_id = v_actor
      AND m.role IN ('owner', 'admin', 'manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  /* 3. Validar rango */
  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_range');
  END IF;

  /* 4. Cargar festivos de la empresa si la plantilla los respeta */
  v_holiday_dates := '{}'::DATE[];
  IF v_template.skip_holidays THEN
    SELECT array_agg(holiday_date) INTO v_holiday_dates
    FROM public.company_holidays
    WHERE company_id = v_company_id
      AND holiday_date BETWEEN p_start_date AND p_end_date;
    v_holiday_dates := COALESCE(v_holiday_dates, '{}'::DATE[]);
  END IF;

  /* 5. Iterar por cada usuario y cada día del rango */
  FOREACH v_user IN ARRAY p_user_ids LOOP
    /* Verificar que el usuario es miembro de la empresa */
    IF NOT EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = v_user AND company_id = v_company_id
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_day := p_start_date;
    WHILE v_day <= p_end_date LOOP
      v_dow := EXTRACT(DOW FROM v_day)::INT; /* 0=Dom, 1=Lun, … 6=Sab */

      /* Saltar festivos si la plantilla así lo indica */
      IF v_template.skip_holidays AND v_day = ANY(v_holiday_dates) THEN
        v_day := v_day + INTERVAL '1 day';
        CONTINUE;
      END IF;

      v_day_cfg := CASE v_dow
        WHEN 0 THEN v_template.sunday
        WHEN 1 THEN v_template.monday
        WHEN 2 THEN v_template.tuesday
        WHEN 3 THEN v_template.wednesday
        WHEN 4 THEN v_template.thursday
        WHEN 5 THEN v_template.friday
        WHEN 6 THEN v_template.saturday
      END;

      /* Día sin configurar = libre, no se inserta */
      IF v_day_cfg IS NULL OR v_day_cfg = 'null'::jsonb THEN
        v_day := v_day + INTERVAL '1 day';
        CONTINUE;
      END IF;

      v_start := v_day_cfg->>'start';
      v_end := v_day_cfg->>'end';
      v_morning_end := v_day_cfg->>'morning_end';
      v_afternoon_start := v_day_cfg->>'afternoon_start';
      v_hours := COALESCE(
        (v_day_cfg->>'expected_hours')::NUMERIC,
        8.0
      );

      IF v_start IS NULL OR v_end IS NULL THEN
        v_day := v_day + INTERVAL '1 day';
        CONTINUE;
      END IF;

      /* Insertar / actualizar scheduled_hours */
      IF p_overwrite THEN
        INSERT INTO public.scheduled_hours (
          user_id, company_id, date,
          start_time, end_time, expected_hours,
          morning_end_time, afternoon_start_time,
          created_by, notes
        )
        VALUES (
          v_user, v_company_id, v_day,
          v_start, v_end, v_hours,
          v_morning_end, v_afternoon_start,
          v_actor, 'Aplicado desde plantilla: ' || v_template.name
        )
        ON CONFLICT (user_id, date) DO UPDATE
          SET start_time = EXCLUDED.start_time,
              end_time = EXCLUDED.end_time,
              expected_hours = EXCLUDED.expected_hours,
              morning_end_time = EXCLUDED.morning_end_time,
              afternoon_start_time = EXCLUDED.afternoon_start_time,
              notes = EXCLUDED.notes,
              updated_at = now();
        v_count := v_count + 1;
      ELSE
        INSERT INTO public.scheduled_hours (
          user_id, company_id, date,
          start_time, end_time, expected_hours,
          morning_end_time, afternoon_start_time,
          created_by, notes
        )
        VALUES (
          v_user, v_company_id, v_day,
          v_start, v_end, v_hours,
          v_morning_end, v_afternoon_start,
          v_actor, 'Aplicado desde plantilla: ' || v_template.name
        )
        ON CONFLICT (user_id, date) DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
      END IF;

      v_day := v_day + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted_or_updated', v_count,
    'skipped_users', v_skipped,
    'template_name', v_template.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_schedule_template(UUID, UUID[], DATE, DATE, BOOLEAN)
  TO authenticated;
