-- ============================================
-- PART 1: Extend existing tables
-- ============================================

-- Extend companies table
ALTER TABLE public.companies 
ADD COLUMN owner_user_id UUID REFERENCES public.profiles(id),
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'grace', 'suspended')),
ADD COLUMN policies JSONB DEFAULT '{}';

-- Extend profiles table
ALTER TABLE public.profiles
ADD COLUMN center_id UUID,
ADD COLUMN team_id UUID;

-- Extend time_events table
ALTER TABLE public.time_events
ADD COLUMN source TEXT CHECK (source IN ('mobile', 'web', 'kiosk')),
ADD COLUMN device_id UUID,
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN photo_url TEXT,
ADD COLUMN meta JSONB DEFAULT '{}';

-- Update event_time default if not set
ALTER TABLE public.time_events 
ALTER COLUMN event_time SET DEFAULT NOW();

-- Extend work_sessions table
ALTER TABLE public.work_sessions
ADD COLUMN status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'auto_closed'));

-- ============================================
-- PART 2: Create new tables
-- ============================================

-- Centers table
CREATE TABLE public.centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  geojson JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Devices table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mobile', 'kiosk')),
  secret_hash TEXT,
  meta JSONB DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device tokens table
CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Correction requests table
CREATE TABLE public.correction_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acting_as_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  diff JSONB,
  ip INET,
  user_agent TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints for profiles
ALTER TABLE public.profiles
ADD CONSTRAINT fk_profiles_center FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_profiles_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add foreign key constraint for time_events
ALTER TABLE public.time_events
ADD CONSTRAINT fk_time_events_device FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE SET NULL;