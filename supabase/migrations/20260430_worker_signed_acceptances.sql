-- =====================================================
-- Aceptaciones firmadas digitalmente por el trabajador
-- =====================================================
-- Cumple obligación informativa RGPD + RD-Ley 8/2019:
-- el trabajador firma electrónicamente al alta y queda registro
-- inmutable accesible al owner.

CREATE TABLE IF NOT EXISTS public.worker_signed_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,        -- 'contract', 'rgpd_clause', 'card_acceptance', etc
  document_title TEXT NOT NULL,
  document_html TEXT NOT NULL,        -- copia exacta del documento firmado
  document_hash TEXT NOT NULL,        -- SHA-256 del documento
  signature_image TEXT NOT NULL,      -- imagen base64 (PNG) de la firma
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  geo_lat NUMERIC(10, 7),
  geo_lng NUMERIC(10, 7),
  full_name_snapshot TEXT,
  dni_snapshot TEXT,
  notes TEXT,
  UNIQUE (company_id, user_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_worker_acceptances_company
  ON public.worker_signed_acceptances (company_id, signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_acceptances_user
  ON public.worker_signed_acceptances (user_id, document_type);

ALTER TABLE public.worker_signed_acceptances ENABLE ROW LEVEL SECURITY;

-- El propio trabajador puede leer sus aceptaciones
DROP POLICY IF EXISTS worker_acceptances_self_read ON public.worker_signed_acceptances;
CREATE POLICY worker_acceptances_self_read ON public.worker_signed_acceptances
  FOR SELECT
  USING (user_id = auth.uid());

-- Owner/admin/manager pueden leer aceptaciones de la empresa
DROP POLICY IF EXISTS worker_acceptances_managers_read ON public.worker_signed_acceptances;
CREATE POLICY worker_acceptances_managers_read ON public.worker_signed_acceptances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = worker_signed_acceptances.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'manager')
    )
  );

-- Insert: solo el propio usuario puede firmar (autenticado, su user_id)
DROP POLICY IF EXISTS worker_acceptances_self_insert ON public.worker_signed_acceptances;
CREATE POLICY worker_acceptances_self_insert ON public.worker_signed_acceptances
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- IMPORTANTE: NO permitir UPDATE ni DELETE — las firmas son inmutables.
-- (Sin políticas de update/delete las operaciones quedan bloqueadas por RLS).

-- Marca en profiles de si el trabajador ha firmado
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
