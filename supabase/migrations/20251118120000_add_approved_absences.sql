-- Create approved_absences table for tracking approved schedule adjustments
CREATE TABLE public.approved_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  absence_type TEXT NOT NULL,
  time_change TEXT,
  notes TEXT,
  approved_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approved_absences_company_date ON public.approved_absences(company_id, date);

ALTER TABLE public.approved_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approved adjustments"
ON public.approved_absences
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = approved_absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Managers can insert approved adjustments"
ON public.approved_absences
FOR INSERT
WITH CHECK (
  approved_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = approved_absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Managers can update approved adjustments"
ON public.approved_absences
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = approved_absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Managers can delete approved adjustments"
ON public.approved_absences
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = approved_absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);
