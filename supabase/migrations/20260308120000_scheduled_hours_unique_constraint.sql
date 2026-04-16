-- Ensure scheduled_hours has a unique constraint on (user_id, date) for upsert/ON CONFLICT.
-- 1) Remove duplicates (keep one row per user_id, date: the one with latest updated_at).
-- 2) Add the unique constraint.

-- Delete duplicate rows: keep one per (user_id, date), the one with latest updated_at
DELETE FROM public.scheduled_hours
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, date) id
  FROM public.scheduled_hours
  ORDER BY user_id, date, updated_at DESC NULLS LAST, id
);

DO $$
BEGIN
  ALTER TABLE public.scheduled_hours
    ADD CONSTRAINT scheduled_hours_user_id_date_key UNIQUE (user_id, date);
EXCEPTION
  WHEN duplicate_object THEN NULL; -- constraint or index already exists
END $$;
