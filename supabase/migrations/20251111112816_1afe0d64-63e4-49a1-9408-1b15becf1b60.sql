-- Drop and recreate the INSERT policy with explicit conditions
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

-- Create a more permissive policy for INSERT
CREATE POLICY "Allow insert companies"
ON public.companies
FOR INSERT
WITH CHECK (
  -- Allow if user is authenticated
  auth.uid() IS NOT NULL
  -- OR allow if the owner_user_id matches the authenticated user
  OR owner_user_id = auth.uid()
);

-- Also ensure the policy works for RETURNING clause
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Grant explicit permissions
GRANT INSERT ON public.companies TO authenticated;
GRANT SELECT ON public.companies TO authenticated;
GRANT UPDATE ON public.companies TO authenticated;