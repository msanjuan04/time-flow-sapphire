-- Allow FastClock source and store point_id for trazabilidad
ALTER TABLE public.time_events
DROP CONSTRAINT IF EXISTS time_events_source_check;

ALTER TABLE public.time_events
ADD CONSTRAINT time_events_source_check CHECK (source IN ('mobile', 'web', 'kiosk', 'fastclock'));

ALTER TABLE public.time_events
ADD COLUMN IF NOT EXISTS point_id TEXT;

ALTER TABLE public.work_sessions
ADD COLUMN IF NOT EXISTS point_id TEXT;
