-- Add login_code column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_code TEXT;

-- Create unique index on login_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_login_code ON public.profiles(login_code) WHERE login_code IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.login_code IS 'Unique 6-digit code for passwordless login';

-- Create function to generate unique login codes
CREATE OR REPLACE FUNCTION public.generate_login_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 6-digit code
    new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE login_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;