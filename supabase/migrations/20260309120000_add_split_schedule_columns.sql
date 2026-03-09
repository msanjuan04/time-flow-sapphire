-- Horario partido: guardar fin de mañana e inicio de tarde para no colapsar a un solo bloque
-- Si morning_end_time y afternoon_start_time son NOT NULL, la jornada es partida.
ALTER TABLE public.scheduled_hours
  ADD COLUMN IF NOT EXISTS morning_end_time TEXT,
  ADD COLUMN IF NOT EXISTS afternoon_start_time TEXT;
