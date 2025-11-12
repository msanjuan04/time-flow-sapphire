-- Drop existing restrictive policy for company creation
DROP POLICY IF EXISTS "Authenticated users create companies" ON public.companies;

-- Create new policy that allows service role (superadmins) to create companies
CREATE POLICY "Superadmins and authenticated users can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (
  -- Allow if authenticated user exists OR if using service role (auth.uid() is null when using service role)
  auth.uid() IS NOT NULL OR auth.role() = 'service_role'
);

-- Also allow superadmins to view all companies
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;

CREATE POLICY "Users can view their companies"
ON public.companies
FOR SELECT
USING (
  -- Users can see their own companies
  owner_user_id = auth.uid() 
  OR id IN (SELECT company_id FROM public.memberships WHERE user_id = auth.uid())
  -- Superadmins can see all companies via service role
  OR auth.role() = 'service_role'
  OR is_superadmin()
);