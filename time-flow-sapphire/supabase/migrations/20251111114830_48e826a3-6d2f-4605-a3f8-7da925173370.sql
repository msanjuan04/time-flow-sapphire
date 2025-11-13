-- Allow users to mark their own invites as accepted
-- This is necessary when a user accepts an invitation
CREATE POLICY "Users can accept their own invites"
ON public.invites
FOR UPDATE
TO authenticated
USING (
  status = 'pending' 
  AND expires_at > now()
  AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  status = 'accepted'
);