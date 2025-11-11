-- Create enum for incident types
CREATE TYPE public.incident_type AS ENUM ('late_arrival', 'early_departure', 'missing_checkout', 'missing_checkin', 'other');

-- Create enum for incident status
CREATE TYPE public.incident_status AS ENUM ('pending', 'resolved', 'dismissed');

-- Incidents table
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  incident_type incident_type NOT NULL,
  incident_date DATE NOT NULL,
  status incident_status NOT NULL DEFAULT 'pending',
  description TEXT,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for incidents
CREATE POLICY "Users can view own incidents"
  ON public.incidents FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = incidents.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can manage incidents"
  ON public.incidents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = incidents.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_incidents
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_incidents_user_id ON public.incidents(user_id);
CREATE INDEX idx_incidents_company_id ON public.incidents(company_id);
CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_date ON public.incidents(incident_date);