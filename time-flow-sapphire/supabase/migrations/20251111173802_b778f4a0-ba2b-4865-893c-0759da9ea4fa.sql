-- Create absence_type enum
CREATE TYPE public.absence_type AS ENUM ('vacation', 'sick_leave', 'personal', 'other');

-- Create absences table
CREATE TABLE public.absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  absence_type public.absence_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT absences_date_check CHECK (end_date >= start_date)
);

-- Create scheduled_hours table for expected work hours
CREATE TABLE public.scheduled_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  date DATE NOT NULL,
  expected_hours NUMERIC(5,2) NOT NULL DEFAULT 8.0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS on absences
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

-- RLS policies for absences
CREATE POLICY "Users can view own absences"
ON public.absences
FOR SELECT
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Managers can create absences"
ON public.absences
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Users can create own absence requests"
ON public.absences
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND created_by = auth.uid()
  AND status = 'pending'
);

CREATE POLICY "Managers can update absences"
ON public.absences
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Managers can delete absences"
ON public.absences
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = absences.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

-- Enable RLS on scheduled_hours
ALTER TABLE public.scheduled_hours ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_hours
CREATE POLICY "Users can view own scheduled hours"
ON public.scheduled_hours
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = scheduled_hours.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Managers can manage scheduled hours"
ON public.scheduled_hours
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = scheduled_hours.company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
  )
);

-- Create trigger for updated_at on absences
CREATE TRIGGER update_absences_updated_at
BEFORE UPDATE ON public.absences
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger for updated_at on scheduled_hours
CREATE TRIGGER update_scheduled_hours_updated_at
BEFORE UPDATE ON public.scheduled_hours
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();