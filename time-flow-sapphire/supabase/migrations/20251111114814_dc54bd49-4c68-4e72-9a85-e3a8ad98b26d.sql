-- Drop the restrictive policy that requires authentication to view invites by token
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.invites;

-- Create new policy that allows unauthenticated users to view pending invites by token
-- This is necessary for the accept-invite page to work before user is authenticated
CREATE POLICY "Unauthenticated users can view pending invites by token"
ON public.invites
FOR SELECT
TO anon
USING (
  status = 'pending' 
  AND expires_at > now()
);

-- Also allow authenticated users to view by token (for logged-in users accepting invites)
CREATE POLICY "Authenticated users can view pending invites by token"
ON public.invites
FOR SELECT
TO authenticated
USING (
  status = 'pending' 
  AND expires_at > now()
);