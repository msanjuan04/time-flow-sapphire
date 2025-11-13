-- ============================================
-- MIGRATION SCRIPT - GTiQ Database Schema
-- ============================================
-- This script recreates the complete database structure
-- Run this in your new Supabase project SQL Editor
-- ============================================

-- ============================================
-- 1. CREATE CUSTOM TYPES (ENUMS)
-- ============================================

CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'manager', 'worker');
CREATE TYPE public.absence_type AS ENUM ('vacation', 'sick_leave', 'personal', 'other');
CREATE TYPE public.time_event_type AS ENUM ('clock_in', 'clock_out', 'pause_start', 'pause_end');
CREATE TYPE public.incident_type AS ENUM ('late_arrival', 'early_departure', 'missing_clock', 'other');
CREATE TYPE public.incident_status AS ENUM ('pending', 'resolved', 'dismissed');

-- ============================================
-- 2. CREATE TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  center_id UUID,
  team_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Superadmins table
CREATE TABLE public.superadmins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT DEFAULT 'active',
  policies JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships table
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'worker',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Centers table
CREATE TABLE public.centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  geojson JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  center_id UUID REFERENCES public.centers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign keys to profiles for center and team
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id),
  ADD CONSTRAINT profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);

-- Invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  center_id UUID REFERENCES public.centers(id),
  team_id UUID REFERENCES public.teams(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Devices table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.centers(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  secret_hash TEXT,
  meta JSONB DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Device tokens table
CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Time events table
CREATE TABLE public.time_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id),
  event_type public.time_event_type NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  photo_url TEXT,
  notes TEXT,
  source TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Work sessions table
CREATE TABLE public.work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMPTZ NOT NULL,
  clock_out_time TIMESTAMPTZ,
  total_work_duration INTERVAL,
  total_pause_duration INTERVAL DEFAULT '0'::INTERVAL,
  status TEXT DEFAULT 'open',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Absences table
CREATE TABLE public.absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  absence_type public.absence_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scheduled hours table
CREATE TABLE public.scheduled_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  expected_hours NUMERIC NOT NULL DEFAULT 8.0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Incidents table
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_type public.incident_type NOT NULL,
  incident_date DATE NOT NULL,
  description TEXT,
  status public.incident_status NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Correction requests table
CREATE TABLE public.correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  payload JSONB NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  manager_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  acting_as_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  diff JSONB,
  reason TEXT,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reports sanitized view (for privacy)
CREATE VIEW public.reports_sanitized AS
SELECT 
  id,
  company_id,
  user_id,
  device_id,
  event_type,
  event_time,
  source,
  created_at,
  meta - 'latitude' - 'longitude' - 'photo_url' AS meta_sanitized
FROM public.time_events;

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

CREATE INDEX idx_memberships_company_id ON public.memberships(company_id);
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_time_events_company_user ON public.time_events(company_id, user_id, event_time DESC);
CREATE INDEX idx_work_sessions_company_user ON public.work_sessions(company_id, user_id, clock_in_time DESC);
CREATE INDEX idx_absences_company_user ON public.absences(company_id, user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_audit_logs_company_created ON public.audit_logs(company_id, created_at DESC);

-- ============================================
-- 4. CREATE FUNCTIONS
-- ============================================

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.superadmins 
    WHERE user_id = auth.uid()
  );
$$;

-- Function to get user role in company
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid, p_company_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.memberships
  WHERE user_id = p_user_id 
    AND company_id = p_company_id
  LIMIT 1;
$$;

-- Function to check if user has company membership
CREATE OR REPLACE FUNCTION public.has_company_membership(p_user_id uuid, p_company_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.memberships
    WHERE user_id = p_user_id 
      AND company_id = p_company_id
  );
$$;

-- Function to check if company is active
CREATE OR REPLACE FUNCTION public.check_company_active(p_company_id uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.companies
  WHERE id = p_company_id;
  
  RETURN v_status = 'active';
END;
$$;

-- Function to validate geofence
CREATE OR REPLACE FUNCTION public.validate_geofence(
  p_company_id uuid,
  p_center_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_geojson JSONB;
  v_policies JSONB;
  v_require_gps BOOLEAN;
BEGIN
  -- Check if GPS is required
  SELECT policies INTO v_policies
  FROM public.companies
  WHERE id = p_company_id;
  
  v_require_gps := COALESCE((v_policies->>'require_gps')::BOOLEAN, false);
  
  IF NOT v_require_gps THEN
    RETURN true;
  END IF;
  
  -- If GPS required but no coordinates provided
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get center geofence
  SELECT geojson INTO v_geojson
  FROM public.centers
  WHERE id = p_center_id;
  
  -- If no geofence defined, allow
  IF v_geojson IS NULL THEN
    RETURN true;
  END IF;
  
  -- For now, return true (would need PostGIS for actual validation)
  RETURN true;
END;
$$;

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_company_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_diff jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    company_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    diff,
    reason
  ) VALUES (
    p_company_id,
    p_actor_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_diff,
    p_reason
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Function to check user is active before clocking
CREATE OR REPLACE FUNCTION public.check_user_active_before_clock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active BOOLEAN;
BEGIN
  -- Get user's active status
  SELECT is_active INTO v_is_active
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- If user is not active, prevent the time event
  IF v_is_active = FALSE THEN
    RAISE EXCEPTION 'Usuario desactivado. No puede fichar.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 5. CREATE TRIGGERS
-- ============================================

-- Trigger on auth.users for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_work_sessions_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_absences_updated_at
  BEFORE UPDATE ON public.absences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_scheduled_hours_updated_at
  BEFORE UPDATE ON public.scheduled_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_correction_requests_updated_at
  BEFORE UPDATE ON public.correction_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to check user is active before clocking
CREATE TRIGGER check_user_active_before_time_event
  BEFORE INSERT ON public.time_events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_active_before_clock();

-- ============================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. CREATE RLS POLICIES
-- ============================================

-- PROFILES POLICIES
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users view company profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM memberships m1
      JOIN memberships m2 ON m1.company_id = m2.company_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = profiles.id
        AND m1.role IN ('owner', 'admin', 'manager')
    )
  );

-- SUPERADMINS POLICIES
CREATE POLICY "Superadmins can view superadmins" ON public.superadmins
  FOR SELECT USING (is_superadmin());

CREATE POLICY "Superadmins can insert superadmins" ON public.superadmins
  FOR INSERT WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can delete superadmins" ON public.superadmins
  FOR DELETE USING (is_superadmin());

-- COMPANIES POLICIES
CREATE POLICY "Users can view their companies" ON public.companies
  FOR SELECT USING (
    owner_user_id = auth.uid() 
    OR id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid())
    OR auth.role() = 'service_role'
    OR is_superadmin()
  );

CREATE POLICY "Superadmins and authenticated users can create companies" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');

CREATE POLICY "Owners can update company" ON public.companies
  FOR UPDATE USING (get_user_role(auth.uid(), id) IN ('owner', 'admin'));

-- MEMBERSHIPS POLICIES
CREATE POLICY "Users can view own memberships" ON public.memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view company memberships" ON public.memberships
  FOR SELECT USING (get_user_role(auth.uid(), company_id) IN ('owner', 'admin'));

CREATE POLICY "Managers can view company memberships" ON public.memberships
  FOR SELECT USING (get_user_role(auth.uid(), company_id) = 'manager');

CREATE POLICY "Users can create memberships" ON public.memberships
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR get_user_role(auth.uid(), company_id) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update memberships" ON public.memberships
  FOR UPDATE USING (get_user_role(auth.uid(), company_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can delete memberships" ON public.memberships
  FOR DELETE USING (get_user_role(auth.uid(), company_id) IN ('owner', 'admin'));

-- CENTERS POLICIES
CREATE POLICY "Company members can view centers" ON public.centers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = centers.company_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage centers" ON public.centers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = centers.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- TEAMS POLICIES
CREATE POLICY "Company members can view teams" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = teams.company_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage teams" ON public.teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = teams.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- INVITES POLICIES
CREATE POLICY "Owners and admins can view company invites" ON public.invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = invites.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Authenticated users can view pending invites by token" ON public.invites
  FOR SELECT USING (status = 'pending' AND expires_at > now());

CREATE POLICY "Unauthenticated users can view pending invites by token" ON public.invites
  FOR SELECT USING (status = 'pending' AND expires_at > now());

CREATE POLICY "Owners and admins can create invites" ON public.invites
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = invites.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update invites" ON public.invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = invites.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can accept their own invites" ON public.invites
  FOR UPDATE USING (
    status = 'pending' 
    AND expires_at > now() 
    AND email = auth.email()
  )
  WITH CHECK (status = 'accepted');

CREATE POLICY "Owners and admins can delete invites" ON public.invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = invites.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- DEVICES POLICIES
CREATE POLICY "Company members can view devices" ON public.devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = devices.company_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage devices" ON public.devices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = devices.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- DEVICE TOKENS POLICIES
CREATE POLICY "Users can view own device tokens" ON public.device_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own device tokens" ON public.device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- TIME EVENTS POLICIES
CREATE POLICY "Users create time events" ON public.time_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view time events" ON public.time_events
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.company_id = time_events.company_id 
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 
      FROM memberships m
      JOIN profiles p ON p.id = auth.uid()
      JOIN profiles target_p ON target_p.id = time_events.user_id
      WHERE m.company_id = time_events.company_id
        AND m.user_id = auth.uid()
        AND m.role = 'manager'
        AND (
          (p.center_id IS NOT NULL AND target_p.center_id = p.center_id)
          OR (p.team_id IS NOT NULL AND target_p.team_id = p.team_id)
        )
    )
  );

-- WORK SESSIONS POLICIES
CREATE POLICY "Users create work sessions" ON public.work_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own work sessions" ON public.work_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view work sessions" ON public.work_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.company_id = work_sessions.company_id 
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 
      FROM memberships m
      JOIN profiles p ON p.id = auth.uid()
      JOIN profiles target_p ON target_p.id = work_sessions.user_id
      WHERE m.company_id = work_sessions.company_id
        AND m.user_id = auth.uid()
        AND m.role = 'manager'
        AND (
          (p.center_id IS NOT NULL AND target_p.center_id = p.center_id)
          OR (p.team_id IS NOT NULL AND target_p.team_id = p.team_id)
        )
    )
  );

-- ABSENCES POLICIES
CREATE POLICY "Users can view own absences" ON public.absences
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = absences.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can create own absence requests" ON public.absences
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    AND created_by = auth.uid() 
    AND status = 'pending'
  );

CREATE POLICY "Managers can create absences" ON public.absences
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = absences.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Managers can update absences" ON public.absences
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = absences.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Managers can delete absences" ON public.absences
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = absences.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- SCHEDULED HOURS POLICIES
CREATE POLICY "Users can view own scheduled hours" ON public.scheduled_hours
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = scheduled_hours.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Managers can manage scheduled hours" ON public.scheduled_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = scheduled_hours.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- INCIDENTS POLICIES
CREATE POLICY "Users can view own incidents" ON public.incidents
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = incidents.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can manage incidents" ON public.incidents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = incidents.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- CORRECTION REQUESTS POLICIES
CREATE POLICY "Users can view own correction requests" ON public.correction_requests
  FOR SELECT USING (
    user_id = auth.uid() 
    OR submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = correction_requests.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Users create correction requests" ON public.correction_requests
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid() 
    AND has_company_membership(auth.uid(), company_id)
  );

CREATE POLICY "Managers and admins can update correction requests" ON public.correction_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = correction_requests.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ALERTS POLICIES
CREATE POLICY "Company members can view alerts" ON public.alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = alerts.company_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage alerts" ON public.alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = alerts.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- AUDIT LOGS POLICIES
CREATE POLICY "Owners and admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE company_id = audit_logs.company_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Export data from Lovable Cloud (as CSV)
-- 2. Import data into this new Supabase project
-- 3. Update your Lovable project to use these credentials
-- ============================================
