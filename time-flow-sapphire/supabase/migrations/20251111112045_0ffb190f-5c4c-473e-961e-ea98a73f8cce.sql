-- Drop existing problematic policies
DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON public.memberships;
DROP POLICY IF EXISTS "Users can view memberships in their companies" ON public.memberships;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid, p_company_id uuid)
RETURNS user_role
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

-- Create security definer function to check if user has membership
CREATE OR REPLACE FUNCTION public.has_company_membership(p_user_id uuid, p_company_id uuid)
RETURNS boolean
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

-- Policy: Users can view their own memberships
CREATE POLICY "Users can view own memberships"
ON public.memberships
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Owners and admins can view all memberships in their company
CREATE POLICY "Admins can view company memberships"
ON public.memberships
FOR SELECT
USING (
  public.get_user_role(auth.uid(), company_id) IN ('owner', 'admin')
);

-- Policy: Managers can view memberships in their company
CREATE POLICY "Managers can view company memberships"
ON public.memberships
FOR SELECT
USING (
  public.get_user_role(auth.uid(), company_id) = 'manager'
);

-- Policy: Authenticated users can create their first membership (for onboarding)
CREATE POLICY "Users can create memberships"
ON public.memberships
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR public.get_user_role(auth.uid(), company_id) IN ('owner', 'admin')
);

-- Policy: Owners and admins can update memberships
CREATE POLICY "Admins can update memberships"
ON public.memberships
FOR UPDATE
USING (
  public.get_user_role(auth.uid(), company_id) IN ('owner', 'admin')
);

-- Policy: Owners and admins can delete memberships
CREATE POLICY "Admins can delete memberships"
ON public.memberships
FOR DELETE
USING (
  public.get_user_role(auth.uid(), company_id) IN ('owner', 'admin')
);