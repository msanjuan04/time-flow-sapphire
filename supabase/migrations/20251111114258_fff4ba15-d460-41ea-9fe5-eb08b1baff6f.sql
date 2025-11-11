-- Add is_active column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index for faster queries on active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Add comment
COMMENT ON COLUMN public.profiles.is_active IS 'Indicates if the user account is active or deactivated';