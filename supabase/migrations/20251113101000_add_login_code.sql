-- Add login_code column to profiles for code-only authentication
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_code CHAR(6);

-- Function to generate unique 6-digit codes
CREATE OR REPLACE FUNCTION public.generate_login_code()
RETURNS CHAR(6)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code CHAR(6);
BEGIN
  LOOP
    new_code := LPAD((FLOOR(random() * 1000000))::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE login_code = new_code
    );
  END LOOP;
  RETURN new_code;
END;
$$;

-- Populate missing codes
UPDATE public.profiles
SET login_code = public.generate_login_code()
WHERE login_code IS NULL;

-- Ensure future rows always get a code
ALTER TABLE public.profiles
  ALTER COLUMN login_code SET NOT NULL,
  ALTER COLUMN login_code SET DEFAULT public.generate_login_code();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_login_code
  ON public.profiles(login_code);

COMMENT ON COLUMN public.profiles.login_code IS 'Six-digit code used for passwordless logins';

-- Ensure fixed code for GTiQ superadmin if the user already exists
UPDATE public.profiles
SET login_code = '739421'
WHERE email = 'gnerai@gneraitiq.com';

INSERT INTO public.superadmins (user_id)
SELECT id FROM public.profiles WHERE email = 'gnerai@gneraitiq.com'
ON CONFLICT (user_id) DO NOTHING;
