import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotifyManagersInput {
  companyId: string;
  title: string;
  message: string;
  type?: NotificationType;
  entityType?: string;
  entityId?: string;
  /** If set, also exclude this user_id (e.g. the requester). */
  excludeUserId?: string;
}

/**
 * Inserts an in-app notification for every owner/admin/manager of the company.
 * Safe to call from the client: notifications RLS allows inserts.
 * Failures are logged but never thrown — notifications are best-effort.
 */
export const notifyManagers = async (input: NotifyManagersInput): Promise<void> => {
  try {
    const { data: managers, error } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("company_id", input.companyId)
      .in("role", ["owner", "admin", "manager"]);

    if (error) {
      console.error("notifyManagers: failed to fetch managers", error);
      return;
    }

    const recipients = Array.from(
      new Set(
        (managers || [])
          .map((m: { user_id: string }) => m.user_id)
          .filter((id) => !!id && id !== input.excludeUserId)
      )
    );

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
