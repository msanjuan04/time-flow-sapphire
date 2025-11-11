-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can accept their own invites" ON public.invites;

-- Recreate the policy using auth.email() instead of querying auth.users
CREATE POLICY "Users can accept their own invites"
ON public.invites
FOR UPDATE
TO authenticated
USING (
  status = 'pending' 
  AND expires_at > now() 
  AND email = auth.email()
)
WITH CHECK (
  status = 'accepted'
);