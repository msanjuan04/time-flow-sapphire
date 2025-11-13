-- Fix the SELECT policy to allow owners to see their companies even without membership yet
DROP POLICY IF EXISTS "Members can view company" ON public.companies;

-- New SELECT policy that allows:
-- 1. Users who are members (have membership record)
-- 2. Users who are owners (owner_user_id matches)
CREATE POLICY "Users can view companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  -- Can see if you're the owner
  owner_user_id = auth.uid()
  OR
  -- Or if you have a membership
  id IN (
    SELECT company_id 
    FROM public.memberships 
    WHERE user_id = auth.uid()
  )
);

-- Simplify INSERT policy - just check auth
DROP POLICY IF EXISTS "Allow insert companies" ON public.companies;

CREATE POLICY "Authenticated users create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);