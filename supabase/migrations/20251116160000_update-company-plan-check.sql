-- Update companies.plan constraint so we can store the new plan identifiers (basic, empresa, etc.)

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_plan_check;

ALTER TABLE public.companies
  ALTER COLUMN plan SET DEFAULT 'empresa',
  ADD CONSTRAINT companies_plan_check
    CHECK (plan IN ('basic', 'empresa', 'pro', 'advanced', 'custom'));

-- Normalize legacy values so they keep working with the new check constraint
UPDATE public.companies SET plan = 'basic' WHERE plan = 'free';
UPDATE public.companies SET plan = 'advanced' WHERE plan = 'enterprise';

COMMENT ON COLUMN public.companies.plan IS
'Subscription plan for the company (basic, empresa, pro, advanced, custom).';
