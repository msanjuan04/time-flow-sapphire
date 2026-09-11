-- =====================================================
-- Permisos: cerrar accesos abiertos y arreglar las pantallas del responsable
-- =====================================================
-- Revisión 2026-09-14, preparando la entrada de una clínica.
-- Idempotente: se puede ejecutar dos veces sin efecto adicional.
-- Todo en una transacción: si una parte falla, no se aplica ninguna.

BEGIN;

-- ─────────────────────────────────────────────────────
-- 1. memberships
-- ─────────────────────────────────────────────────────
-- debug_select_memberships (USING true) dejaba a cualquier usuario con sesión
-- leer las membresías de TODAS las empresas. Se sustituye por: ves las
-- membresías de las empresas a las que perteneces. has_company_membership es
-- SECURITY DEFINER, así que no hay recursión de RLS. Mantiene funcionando los
-- avisos a responsables que lanza el navegador de un trabajador.
DROP POLICY IF EXISTS debug_select_memberships ON public.memberships;
DROP POLICY IF EXISTS memberships_same_company_select ON public.memberships;
CREATE POLICY memberships_same_company_select ON public.memberships
  FOR SELECT TO authenticated
  USING (public.has_company_membership(auth.uid(), company_id));

-- ─────────────────────────────────────────────────────
-- 2. company_compliance_settings
-- ─────────────────────────────────────────────────────
-- cc_select_all / cc_insert_all / cc_update_all (rol public, USING true):
-- cualquiera, incluso sin sesión, podía leer, crear y modificar la
-- configuración de cumplimiento de cualquier empresa. workers_select_settings
-- comparaba m.company_id = m.company_id (siempre cierto).
-- La edge function clock lee con service role: no le afecta.
DROP POLICY IF EXISTS cc_select_all ON public.company_compliance_settings;
DROP POLICY IF EXISTS cc_insert_all ON public.company_compliance_settings;
DROP POLICY IF EXISTS cc_update_all ON public.company_compliance_settings;
DROP POLICY IF EXISTS workers_select_settings ON public.company_compliance_settings;
DROP POLICY IF EXISTS compliance_members_select ON public.company_compliance_settings;
DROP POLICY IF EXISTS compliance_admins_insert ON public.company_compliance_settings;
DROP POLICY IF EXISTS compliance_admins_update ON public.company_compliance_settings;

CREATE POLICY compliance_members_select ON public.company_compliance_settings
  FOR SELECT TO authenticated
  USING (public.has_company_membership(auth.uid(), company_id) OR COALESCE(public.is_superadmin(), false));

CREATE POLICY compliance_admins_insert ON public.company_compliance_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin']::public.user_role[])
    OR COALESCE(public.is_superadmin(), false)
  );

CREATE POLICY compliance_admins_update ON public.company_compliance_settings
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin']::public.user_role[])
    OR COALESCE(public.is_superadmin(), false)
  )
  WITH CHECK (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin']::public.user_role[])
    OR COALESCE(public.is_superadmin(), false)
  );

-- set_compliance_settings es SECURITY DEFINER y no comprobaba quién llama:
-- cualquiera, incluso sin sesión, podía cambiar la configuración de otra
-- empresa. Mismo cuerpo que la versión en producción, con control de rol.
CREATE OR REPLACE FUNCTION public.set_compliance_settings(
  _company_id uuid,
  _max_week_hours integer,
  _max_month_hours integer,
  _min_hours_between_shifts integer,
  _allowed_checkin_start time without time zone,
  _allowed_checkin_end time without time zone,
  _allow_outside_schedule boolean
)
RETURNS public.company_compliance_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _row public.company_compliance_settings;
begin
  if not (
    public.get_user_role(auth.uid(), _company_id) = any (array['owner', 'admin']::public.user_role[])
    or coalesce(public.is_superadmin(), false)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.company_compliance_settings (
    company_id,
    max_week_hours,
    max_month_hours,
    min_hours_between_shifts,
    allowed_checkin_start,
    allowed_checkin_end,
    allow_outside_schedule
  )
  values (
    _company_id,
    _max_week_hours,
    _max_month_hours,
    _min_hours_between_shifts,
    _allowed_checkin_start,
    _allowed_checkin_end,
    coalesce(_allow_outside_schedule, false)
  )
  on conflict (company_id) do update set
    max_week_hours = excluded.max_week_hours,
    max_month_hours = excluded.max_month_hours,
    min_hours_between_shifts = excluded.min_hours_between_shifts,
    allowed_checkin_start = excluded.allowed_checkin_start,
    allowed_checkin_end = excluded.allowed_checkin_end,
    allow_outside_schedule = excluded.allow_outside_schedule,
    updated_at = now();

  select * into _row from public.company_compliance_settings where company_id = _company_id;
  return _row;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_compliance_settings(uuid, integer, integer, integer, time, time, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_compliance_settings(uuid, integer, integer, integer, time, time, boolean)
  TO authenticated;

-- ─────────────────────────────────────────────────────
-- 3. log_audit_event
-- ─────────────────────────────────────────────────────
-- SECURITY DEFINER sin comprobar quién llama: permitía escribir auditoría
-- falsa en nombre de cualquiera, incluso sin sesión. Nadie la usa (ni el
-- frontend ni las edge functions), así que se retira el permiso.
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, uuid, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────
-- 4. audit_logs y notifications
-- ─────────────────────────────────────────────────────
-- "System can insert ..." (WITH CHECK true, rol public) dejaba a cualquiera
-- escribir auditoría y enviar avisos a cualquier usuario. Las edge functions
-- usan service role (no les afecta RLS). El personal ya tiene sus políticas
-- de auditoría (allow_owner_insert_audit, audit_insert_by_staff).
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Los avisos que lanza el navegador (p. ej. un trabajador pide una
-- corrección y se avisa a sus responsables) solo pueden ir a personas de
-- una empresa a la que pertenece quien los envía.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_same_company ON public.notifications;
CREATE POLICY notifications_insert_same_company ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_membership(auth.uid(), company_id)
    AND public.has_company_membership(user_id, company_id)
  );

-- ─────────────────────────────────────────────────────
-- 5. Registro de jornada: el trabajador no escribe directamente
-- ─────────────────────────────────────────────────────
-- Un trabajador podía crear fichajes a su nombre y modificar sus propias
-- sesiones (por ejemplo, cambiar la hora de entrada) llamando a la API sin
-- pasar por las reglas de la edge function clock. Todos los fichajes del
-- trabajador pasan por clock, que escribe con service role.
DROP POLICY IF EXISTS "Users create time events" ON public.time_events;
DROP POLICY IF EXISTS "Users create work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS work_sessions_insert_own ON public.work_sessions;
DROP POLICY IF EXISTS "Users can update own work sessions" ON public.work_sessions;

-- ─────────────────────────────────────────────────────
-- 6. Pantallas del responsable que estaban rotas
-- ─────────────────────────────────────────────────────
-- Con las políticas anteriores solo se podía escribir a nombre propio, así
-- que fallaban: aprobar una corrección (el fichaje no se creaba), añadir un
-- fichaje desde el calendario, y revisar una sesión (el cambio se descartaba
-- sin error y el trabajador seguía sin poder fichar la salida).
DROP POLICY IF EXISTS time_events_staff_insert ON public.time_events;
CREATE POLICY time_events_staff_insert ON public.time_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin', 'manager']::public.user_role[])
  );

DROP POLICY IF EXISTS work_sessions_staff_insert ON public.work_sessions;
CREATE POLICY work_sessions_staff_insert ON public.work_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin', 'manager']::public.user_role[])
  );

DROP POLICY IF EXISTS work_sessions_staff_update ON public.work_sessions;
CREATE POLICY work_sessions_staff_update ON public.work_sessions
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin', 'manager']::public.user_role[])
  )
  WITH CHECK (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin', 'manager']::public.user_role[])
  );

COMMIT;
