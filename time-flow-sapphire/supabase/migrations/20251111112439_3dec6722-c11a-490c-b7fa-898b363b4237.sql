-- Fix companies RLS policies completely

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company members can view their company" ON public.companies;
DROP POLICY IF EXISTS "Owners and admins can update company" ON public.companies;

-- Policy: ANY authenticated user can create a company (onboarding)
CREATE POLICY "Users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Users can view companies where they are members
CREATE POLICY "Members can view company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT company_id 
    FROM public.memberships 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Owners and admins can update their company
CREATE POLICY "Owners can update company"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid(), id) IN ('owner', 'admin')
);

-- Fix profiles RLS - ensure users can always read their own profile
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can always view their own profile
CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can view profiles in their companies
CREATE POLICY "Users view company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.memberships m1
    JOIN public.memberships m2 ON m1.company_id = m2.company_id
    WHERE m1.user_id = auth.uid() 
      AND m2.user_id = profiles.id
      AND m1.role IN ('owner', 'admin', 'manager')
  )
);

-- Users can update their own profile
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- Fix time_events INSERT policy to allow self-insertion
DROP POLICY IF EXISTS "Users can create own time events" ON public.time_events;

CREATE POLICY "Users create time events"
ON public.time_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix work_sessions INSERT policy
DROP POLICY IF EXISTS "Users can create own work sessions" ON public.work_sessions;

CREATE POLICY "Users create work sessions"
ON public.work_sessions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix correction_requests INSERT policy
DROP POLICY IF EXISTS "Workers can create correction requests" ON public.correction_requests;

CREATE POLICY "Users create correction requests"
ON public.correction_requests
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid() 
  AND public.has_company_membership(auth.uid(), company_id)
);