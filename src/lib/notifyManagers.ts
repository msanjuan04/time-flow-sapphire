import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "info" | "success" | "warning" | "error";

/**
 * Categories used to match against per-user notification preferences.
 *  - 'absence'    → absence/vacation requests
 *  - 'correction' → time clock correction requests
 *  - 'clock'      → late arrivals, missing clock-outs, geofence alerts
 *  - 'general'    → anything else
 */
export type NotificationCategory = "absence" | "correction" | "clock" | "general";

export interface NotifyManagersInput {
  companyId: string;
  title: string;
  message: string;
  type?: NotificationType;
  entityType?: string;
  entityId?: string;
  /** Exclude this user_id from recipients (typically the actor). */
  excludeUserId?: string;
  /**
   * The worker the notification is about. When set, managers without this
   * worker in their team/center scope are NOT notified (unless they have
   * scope_filter='all'). Owners and admins follow the same rule but
   * default to scope_filter='all'.
   */
  targetUserId?: string;
  /** Used to match against per-user preferences. Defaults to 'general'. */
  category?: NotificationCategory;
}

interface MembershipRow {
  user_id: string;
  role: string;
}

interface PreferenceRow {
  user_id: string;
  notify_absence_requests: boolean;
  notify_correction_requests: boolean;
  notify_clock_alerts: boolean;
  notify_general: boolean;
  scope_filter: "all" | "my_scope" | "none";
}

const categoryAllowedByPreference = (
  category: NotificationCategory,
  pref: PreferenceRow
): boolean => {
  switch (category) {
    case "absence":
      return pref.notify_absence_requests;
    case "correction":
      return pref.notify_correction_requests;
    case "clock":
      return pref.notify_clock_alerts;
    default:
      return pref.notify_general;
  }
};

const DEFAULT_PREF: PreferenceRow = {
  user_id: "",
  notify_absence_requests: true,
  notify_correction_requests: true,
  notify_clock_alerts: true,
  notify_general: true,
  scope_filter: "all",
};

/**
 * Resolve which managers/owners/admins of a company have the given target
 * user inside their scope (a team they manage, or a center they manage).
 * Returns the set of user IDs.
 */
async function getManagersWithTargetInScope(
  companyId: string,
  targetUserId: string
): Promise<Set<string>> {
  const result = new Set<string>();

  // Direct team manager: someone who manages a team where the target
  // belongs (target.team_id is in teams.id where teams.manager_id = ?)
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("team_id, center_id")
    .eq("id", targetUserId)
    .maybeSingle();
  const targetTeamId = (targetProfile as any)?.team_id ?? null;
  const targetCenterId = (targetProfile as any)?.center_id ?? null;

  if (targetTeamId) {
    const { data } = await supabase
      .from("teams")
      .select("manager_id, center_id")
      .eq("id", targetTeamId)
      .maybeSingle();
    if ((data as any)?.manager_id) result.add((data as any).manager_id);
    // If the team is in a center, the center manager also has scope
    const teamCenterId = (data as any)?.center_id ?? null;
    if (teamCenterId) {
      const { data: c } = await supabase
        .from("centers")
        .select("manager_id")
        .eq("id", teamCenterId)
        .maybeSingle();
      if ((c as any)?.manager_id) result.add((c as any).manager_id);
    }
  }

  if (targetCenterId) {
    const { data } = await supabase
      .from("centers")
      .select("manager_id")
      .eq("id", targetCenterId)
      .maybeSingle();
    if ((data as any)?.manager_id) result.add((data as any).manager_id);
  }

  return result;
}

/**
 * Inserts an in-app notification for the relevant managers of the company,
 * respecting:
 *  - Per-user preferences (notification_preferences)
 *  - Scope: managers with scope_filter='my_scope' only get notified if the
 *    target worker is in their team/center
 *  - Owners and admins receive everything by default (scope_filter='all'),
 *    but can opt out via preferences
 *
 * Best-effort: errors are logged but never thrown.
 */
export const notifyManagers = async (input: NotifyManagersInput): Promise<void> => {
  try {
    const category: NotificationCategory = input.category ?? "general";

    const { data: members, error } = await supabase
      .from("memberships")
      .select("user_id, role")
      .eq("company_id", input.companyId)
      .in("role", ["owner", "admin", "manager"]);

    if (error) {
      console.error("notifyManagers: failed to fetch members", error);
      return;
    }

    const allManagerIds = Array.from(
      new Set(
        ((members as MembershipRow[]) || [])
          .map((m) => m.user_id)
          .filter((id) => !!id && id !== input.excludeUserId)
      )
    );

    if (allManagerIds.length === 0) return;

    // Load per-user preferences in one go
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select(
        "user_id, notify_absence_requests, notify_correction_requests, notify_clock_alerts, notify_general, scope_filter"
      )
      .eq("company_id", input.companyId)
      .in("user_id", allManagerIds);

    const prefByUser = new Map<string, PreferenceRow>();
    for (const p of (prefs as PreferenceRow[]) || []) {
      prefByUser.set(p.user_id, p);
    }

    // If we know the target worker, compute who has them in scope
    let scopeOwners = new Set<string>();
    if (input.targetUserId) {
      scopeOwners = await getManagersWithTargetInScope(
        input.companyId,
        input.targetUserId
      );
    }

    const recipients: string[] = [];
    for (const m of (members as MembershipRow[]) || []) {
      if (!m.user_id || m.user_id === input.excludeUserId) continue;
      const pref = prefByUser.get(m.user_id) ?? { ...DEFAULT_PREF, user_id: m.user_id };

      // 1) Categoría desactivada → no
      if (!categoryAllowedByPreference(category, pref)) continue;

      // 2) Scope check: si scope_filter==='none' → siempre no
      if (pref.scope_filter === "none") continue;

      // 3) Si scope_filter==='my_scope' Y la categoría va dirigida a un
      //    trabajador concreto, solo entra si ese trabajador está en su scope.
      //    Owners/admins típicamente tienen 'all'; si voluntariamente eligen
      //    'my_scope' se les aplica el mismo filtro.
      if (pref.scope_filter === "my_scope" && input.targetUserId) {
        if (!scopeOwners.has(m.user_id)) continue;
      }

      recipients.push(m.user_id);
    }

    if (recipients.length === 0) return;

    const rows = recipients.map((userId) => ({
      company_id: input.companyId,
      user_id: userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "info",
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    }));

    const { error: insertError } = await supabase.from("notifications").insert(rows);
    if (insertError) {
      console.error("notifyManagers: failed to insert notifications", insertError);
    }
  } catch (err) {
    console.error("notifyManagers: unexpected error", err);
  }
};
