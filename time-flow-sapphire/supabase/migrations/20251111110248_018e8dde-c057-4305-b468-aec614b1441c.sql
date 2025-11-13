-- ============================================
-- PART 3: Enable RLS on new tables
-- ============================================

ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 4: RLS Policies
-- ============================================

-- Centers policies
CREATE POLICY "Company members can view centers"
  ON public.centers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = centers.company_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage centers"
  ON public.centers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = centers.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
    )
  );

-- Teams policies
CREATE POLICY "Company members can view teams"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = teams.company_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage teams"
  ON public.teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = teams.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
    )
  );

-- Devices policies
CREATE POLICY "Company members can view devices"
  ON public.devices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = devices.company_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage devices"
  ON public.devices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = devices.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
    )
  );

-- Device tokens policies
CREATE POLICY "Users can view own device tokens"
  ON public.device_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own device tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Correction requests policies
CREATE POLICY "Users can view own correction requests"
  ON public.correction_requests FOR SELECT
  USING (
    user_id = auth.uid() OR
    submitted_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = correction_requests.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Workers can create correction requests"
  ON public.correction_requests FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = correction_requests.company_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers and admins can update correction requests"
  ON public.correction_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = correction_requests.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin', 'manager')
    )
  );

-- Alerts policies
CREATE POLICY "Company members can view alerts"
  ON public.alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = alerts.company_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage alerts"
  ON public.alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = alerts.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
    )
  );

-- Audit logs policies (read-only for most users)
CREATE POLICY "Owners and admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.company_id = audit_logs.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- PART 5: Performance Indexes
-- ============================================

-- Time events indexes
CREATE INDEX idx_time_events_company_user_time ON public.time_events(company_id, user_id, event_time DESC);
CREATE INDEX idx_time_events_device ON public.time_events(device_id);
CREATE INDEX idx_time_events_source ON public.time_events(source);

-- Work sessions indexes
CREATE INDEX idx_work_sessions_company_user_status ON public.work_sessions(company_id, user_id, status);
CREATE INDEX idx_work_sessions_status ON public.work_sessions(status) WHERE status = 'open';

-- Correction requests indexes
CREATE INDEX idx_correction_requests_company_status ON public.correction_requests(company_id, status);
CREATE INDEX idx_correction_requests_user ON public.correction_requests(user_id);
CREATE INDEX idx_correction_requests_manager ON public.correction_requests(manager_id);

-- Devices indexes
CREATE INDEX idx_devices_company ON public.devices(company_id);
CREATE INDEX idx_devices_center ON public.devices(center_id);

-- Centers indexes
CREATE INDEX idx_centers_company ON public.centers(company_id);

-- Teams indexes
CREATE INDEX idx_teams_company ON public.teams(company_id);
CREATE INDEX idx_teams_center ON public.teams(center_id);

-- Profiles indexes
CREATE INDEX idx_profiles_center ON public.profiles(center_id);
CREATE INDEX idx_profiles_team ON public.profiles(team_id);

-- Alerts indexes
CREATE INDEX idx_alerts_company ON public.alerts(company_id);
CREATE INDEX idx_alerts_resolved ON public.alerts(resolved_at) WHERE resolved_at IS NULL;

-- Audit logs indexes
CREATE INDEX idx_audit_logs_company ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Device tokens indexes
CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX idx_device_tokens_expires ON public.device_tokens(expires_at);

-- ============================================
-- PART 6: Triggers for updated_at
-- ============================================

CREATE TRIGGER set_updated_at_correction_requests
  BEFORE UPDATE ON public.correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();