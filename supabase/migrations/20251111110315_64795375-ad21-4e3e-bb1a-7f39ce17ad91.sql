-- ============================================
-- PART 7: Create sanitized reports view
-- ============================================

CREATE OR REPLACE VIEW public.reports_sanitized AS
SELECT 
  te.id,
  te.company_id,
  te.user_id,
  te.event_type,
  te.event_time,
  te.source,
  te.device_id,
  te.created_at,
  -- Exclude PII fields: photo_url, notes from meta
  jsonb_set(
    COALESCE(te.meta, '{}'::jsonb),
    '{notes}',
    'null'::jsonb
  ) as meta_sanitized
FROM public.time_events te;

-- Grant access to the view
GRANT SELECT ON public.reports_sanitized TO authenticated;

-- RLS policy for sanitized reports
ALTER VIEW public.reports_sanitized SET (security_invoker = on);

-- ============================================
-- PART 8: Helper functions for auditing
-- ============================================

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_company_id UUID,
  p_actor_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_diff JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
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

-- Function to check company status
CREATE OR REPLACE FUNCTION public.check_company_active(p_company_id UUID)
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
  p_company_id UUID,
  p_center_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
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
  
  -- TODO: Implement actual geofence validation using PostGIS
  -- For now, return true
  RETURN true;
END;
$$;

-- ============================================
-- PART 9: Update existing policies for Manager scope
-- ============================================

-- Drop and recreate time_events view policy for managers
DROP POLICY IF EXISTS "Users can view own time events" ON public.time_events;

CREATE POLICY "Users can view time events"
  ON public.time_events FOR SELECT
  USING (
    -- Own events
    user_id = auth.uid() 
    OR
    -- Admins and owners
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = time_events.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
    )
    OR
    -- Managers can see their team/center
    EXISTS (
      SELECT 1 FROM public.memberships m
      INNER JOIN public.profiles p ON p.id = auth.uid()
      INNER JOIN public.profiles target_p ON target_p.id = time_events.user_id
      WHERE m.company_id = time_events.company_id
      AND m.user_id = auth.uid()
      AND m.role = 'manager'
      AND (
        (p.center_id IS NOT NULL AND target_p.center_id = p.center_id)
        OR
        (p.team_id IS NOT NULL AND target_p.team_id = p.team_id)
      )
    )
  );

-- Drop and recreate work_sessions view policy for managers
DROP POLICY IF EXISTS "Users can view own work sessions" ON public.work_sessions;

CREATE POLICY "Users can view work sessions"
  ON public.work_sessions FOR SELECT
  USING (
    -- Own sessions
    user_id = auth.uid() 
    OR
    -- Admins and owners
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.company_id = work_sessions.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
    )
    OR
    -- Managers can see their team/center
    EXISTS (
      SELECT 1 FROM public.memberships m
      INNER JOIN public.profiles p ON p.id = auth.uid()
      INNER JOIN public.profiles target_p ON target_p.id = work_sessions.user_id
      WHERE m.company_id = work_sessions.company_id
      AND m.user_id = auth.uid()
      AND m.role = 'manager'
      AND (
        (p.center_id IS NOT NULL AND target_p.center_id = p.center_id)
        OR
        (p.team_id IS NOT NULL AND target_p.team_id = p.team_id)
      )
    )
  );

-- Update profiles view policy to allow managers to see their team
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  USING (
    -- Own profile
    auth.uid() = id
    OR
    -- Admins and owners in same company
    EXISTS (
      SELECT 1 FROM public.memberships m1
      INNER JOIN public.memberships m2 ON m1.company_id = m2.company_id
      WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.id
      AND m1.role IN ('owner', 'admin')
    )
    OR
    -- Managers can see their team/center
    EXISTS (
      SELECT 1 FROM public.memberships m
      INNER JOIN public.profiles manager_p ON manager_p.id = auth.uid()
      INNER JOIN public.memberships target_m ON target_m.user_id = profiles.id
      WHERE m.user_id = auth.uid()
      AND m.role = 'manager'
      AND m.company_id = target_m.company_id
      AND (
        (manager_p.center_id IS NOT NULL AND profiles.center_id = manager_p.center_id)
        OR
        (manager_p.team_id IS NOT NULL AND profiles.team_id = manager_p.team_id)
      )
    )
  );