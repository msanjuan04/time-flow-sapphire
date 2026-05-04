-- =====================================================
-- Preferencias de notificaciones por usuario y empresa
-- =====================================================
-- Permite al owner/admin/manager configurar qué notificaciones recibe
-- y de qué scope: toda la empresa, solo su equipo, o nada.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Categorías de notificaciones
  notify_absence_requests   BOOLEAN NOT NULL DEFAULT true,
  notify_correction_requests BOOLEAN NOT NULL DEFAULT true,
  notify_clock_alerts        BOOLEAN NOT NULL DEFAULT true,
  notify_general             BOOLEAN NOT NULL DEFAULT true,

  -- 'all'         → recibe todo (owner típico hasta ahora)
  -- 'my_scope'    → solo de su equipo/centro asignado
  -- 'none'        → ninguna (silencio)
  scope_filter TEXT NOT NULL DEFAULT 'all' CHECK (scope_filter IN ('all', 'my_scope', 'none')),

  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
  ON public.notification_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_company
  ON public.notification_preferences (company_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Cada usuario gestiona sus propias preferencias
DROP POLICY IF EXISTS notification_prefs_self ON public.notification_preferences;
CREATE POLICY notification_prefs_self ON public.notification_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
