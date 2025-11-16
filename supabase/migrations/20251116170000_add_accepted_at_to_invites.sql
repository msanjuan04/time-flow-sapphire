-- Track when an invite is accepted to improve owner visibility
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.invites.accepted_at IS 'Timestamp when the invitation was accepted by the worker';
