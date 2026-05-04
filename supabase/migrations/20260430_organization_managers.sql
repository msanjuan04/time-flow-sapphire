-- =====================================================
-- Organización: managers por centro y equipo
-- =====================================================
-- 1. Añade manager_id a centros y equipos para poder designar
--    quién manda en cada departamento.
-- 2. Añade descripción opcional.
-- 3. Crea índices para lookups rápidos.

ALTER TABLE public.centers
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_centers_company  ON public.centers(company_id);
CREATE INDEX IF NOT EXISTS idx_centers_manager  ON public.centers(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_company    ON public.teams(company_id);
CREATE INDEX IF NOT EXISTS idx_teams_center     ON public.teams(center_id);
CREATE INDEX IF NOT EXISTS idx_teams_manager    ON public.teams(manager_id) WHERE manager_id IS NOT NULL;

-- =====================================================
-- RLS: lectura por miembro de la empresa, escritura por owner/admin
-- =====================================================
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centers_read ON public.centers;
CREATE POLICY centers_read ON public.centers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = centers.company_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS centers_write ON public.centers;
CREATE POLICY centers_write ON public.centers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = centers.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = centers.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS teams_read ON public.teams;
CREATE POLICY teams_read ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = teams.company_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS teams_write ON public.teams;
CREATE POLICY teams_write ON public.teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = teams.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = teams.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );
