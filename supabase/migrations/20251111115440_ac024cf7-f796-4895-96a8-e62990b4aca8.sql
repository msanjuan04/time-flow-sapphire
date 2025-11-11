-- Add validation to block inactive users from clocking
-- This will be enforced at the database level

-- Create a function to check if user is active before inserting time events
CREATE OR REPLACE FUNCTION public.check_user_active_before_clock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active BOOLEAN;
BEGIN
  -- Get user's active status
  SELECT is_active INTO v_is_active
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- If user is not active, prevent the time event
  IF v_is_active = FALSE THEN
    RAISE EXCEPTION 'Usuario desactivado. No puede fichar.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to check user status before inserting time events
DROP TRIGGER IF EXISTS check_user_active_trigger ON public.time_events;

CREATE TRIGGER check_user_active_trigger
  BEFORE INSERT ON public.time_events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_active_before_clock();