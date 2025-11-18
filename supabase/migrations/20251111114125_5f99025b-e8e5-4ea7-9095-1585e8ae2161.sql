-- Create invites table for managing user invitations
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'worker')),
  center_id UUID REFERENCES public.centers(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')) DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate pending invites for same email in same company
  UNIQUE(company_id, email, status)
);

-- Create index for token lookups (fast invite acceptance)
CREATE INDEX idx_invites_token ON public.invites(token) WHERE status = 'pending';

-- Create index for email lookups
CREATE INDEX idx_invites_email ON public.invites(email, company_id);

-- Create index for expiration cleanup
CREATE INDEX idx_invites_expires_at ON public.invites(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Owners and admins can view all invites for their company
CREATE POLICY "Owners and admins can view company invites"
ON public.invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.company_id = invites.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'manager')
  )
);

-- Owners and admins can create invites for their company
CREATE POLICY "Owners and admins can create invites"
ON public.invites
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.company_id = invites.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'manager')
  )
);

-- Owners and admins can update invites (revoke, etc.)
CREATE POLICY "Owners and admins can update invites"
ON public.invites
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.company_id = invites.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'manager')
  )
);

-- Anyone with the token can view pending invites (for acceptance page)
CREATE POLICY "Anyone can view invite by token"
ON public.invites
FOR SELECT
TO authenticated
USING (status = 'pending' AND expires_at > now());

-- Owners and admins can delete invites
CREATE POLICY "Owners and admins can delete invites"
ON public.invites
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.company_id = invites.company_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'manager')
  )
);
