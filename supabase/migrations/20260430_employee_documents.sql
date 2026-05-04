-- =====================================================
-- Documentos RRHH adjuntos al perfil de cada empleado
-- =====================================================
-- Almacenamos metadatos en una tabla y los ficheros en Supabase Storage.

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  category TEXT NOT NULL CHECK (category IN (
    'contract',          -- Contrato laboral
    'addendum',          -- Anexo o modificación contractual
    'payslip',           -- Nómina
    'training',          -- Formación / certificado
    'medical',           -- Reconocimiento médico
    'prl',               -- Prevención riesgos laborales
    'rgpd',              -- Documentos RGPD
    'id_document',       -- DNI / NIE / pasaporte
    'other'
  )),
  title TEXT NOT NULL,
  description TEXT,

  -- Path dentro del bucket "employee-documents"
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,

  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Marca opcional de fecha relevante (p.ej. fecha del contrato, mes de la nómina)
  document_date DATE,
  expires_at DATE,

  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_company ON public.employee_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_user ON public.employee_documents(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_documents_category ON public.employee_documents(category);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- El propio empleado puede leer sus documentos
DROP POLICY IF EXISTS employee_docs_self_read ON public.employee_documents;
CREATE POLICY employee_docs_self_read ON public.employee_documents
  FOR SELECT
  USING (user_id = auth.uid());

-- Owners/admins/managers de la empresa pueden leer documentos de su empresa
DROP POLICY IF EXISTS employee_docs_managers_read ON public.employee_documents;
CREATE POLICY employee_docs_managers_read ON public.employee_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = employee_documents.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'manager')
    )
  );

-- Owners y admins pueden subir, modificar y eliminar
DROP POLICY IF EXISTS employee_docs_admin_write ON public.employee_documents;
CREATE POLICY employee_docs_admin_write ON public.employee_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = employee_documents.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = employee_documents.company_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- Bucket de Storage
-- =====================================================
-- Crear el bucket "employee-documents" si no existe (privado).
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para el bucket: lectura por miembro de la empresa, escritura solo
-- por owner/admin. La path es {company_id}/{user_id}/{filename}.
DROP POLICY IF EXISTS "employee_docs_storage_read" ON storage.objects;
CREATE POLICY "employee_docs_storage_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'employee-documents'
    AND (
      -- El propio empleado lee sus archivos
      (storage.foldername(name))[2] = auth.uid()::text
      OR
      -- Owners/admins/managers de la empresa
      EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.company_id::text = (storage.foldername(name))[1]
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "employee_docs_storage_write" ON storage.objects;
CREATE POLICY "employee_docs_storage_write" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id::text = (storage.foldername(name))[1]
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "employee_docs_storage_delete" ON storage.objects;
CREATE POLICY "employee_docs_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id::text = (storage.foldername(name))[1]
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );
