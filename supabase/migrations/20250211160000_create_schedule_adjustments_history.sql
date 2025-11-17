-- Create table to log jornada adjustments over time
CREATE TABLE IF NOT EXISTS public.schedule_adjustments_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_from DATE NOT NULL,
  expected_hours NUMERIC(5,2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_history_user ON public.schedule_adjustments_history(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_company ON public.schedule_adjustments_history(company_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_changed_at ON public.schedule_adjustments_history(changed_at DESC);

ALTER TABLE public.schedule_adjustments_history ENABLE ROW LEVEL SECURITY;

-- Allow workers to view their own history and owners/admins to view company data
CREATE POLICY "Users can view own schedule history"
ON public.schedule_adjustments_history
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.company_id = schedule_adjustments_history.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Managers can insert schedule history"
ON public.schedule_adjustments_history
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.company_id = schedule_adjustments_history.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
  )
);
