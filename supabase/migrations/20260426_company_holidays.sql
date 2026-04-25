-- Calendario de festivos por empresa
-- 1) Comunidad autónoma de la empresa (afecta a qué festivos regionales aplican)
-- 2) Festivos locales/municipales custom

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS holiday_region TEXT NOT NULL DEFAULT 'CT';

CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_company_holidays_company
  ON public.company_holidays (company_id, holiday_date);

ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro de la empresa
DROP POLICY IF EXISTS company_holidays_read ON public.company_holidays;
CREATE POLICY company_holidays_read ON public.company_holidays
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = public.company_holidays.company_id
        AND m.user_id = auth.uid()
    )
  );

-- Escritura (insert/update/delete): solo owner/admin
DROP POLICY IF EXISTS company_holidays_write ON public.company_holidays;
CREATE POLICY company_holidays_write ON public.company_holidays
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = public.company_holidays.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = public.company_holidays.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );
