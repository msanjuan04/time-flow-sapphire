-- Add plan field to companies table to track subscription plan
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise'));

-- Add comment explaining the field
COMMENT ON COLUMN public.companies.plan IS 'Subscription plan: free (5 users), pro (50 users), enterprise (unlimited)';