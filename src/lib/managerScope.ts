import { supabase } from "@/integrations/supabase/client";

export interface ManagerScope {
  /** Team IDs that this manager manages directly */
  teamIds: string[];
  /** Center IDs that this manager manages directly */
  centerIds: string[];
  /** All user IDs that fall under this manager's scope (members of those teams/centers + themselves) */
  userIds: string[];
}

/**
 * Computes the scope of a manager: which teams + centers they manage and
 * which users belong to those teams/centers.
 *
 * Used to filter dashboards, reports, and approval flows so a manager only
 * sees data from their own department.
 *
 * - Owners and admins should NOT call this — they see everything.
 * - Workers should NOT call this — they only see their own data.
 *
 * Returns empty arrays if the manager has no teams/centers assigned.
 */
export async function getManagerScope(
  managerId: string,
  companyId: string
): Promise<ManagerScope> {
  if (!managerId || !companyId) {
    return { teamIds: [], centerIds: [], userIds: [] };
  }

  const [teamsRes, centersRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, center_id")
      .eq("company_id", companyId)
      .eq("manager_id", managerId),
    supabase
      .from("centers")
      .select("id")
      .eq("company_id", companyId)
      .eq("manager_id", managerId),
  ]);

  const directTeamIds = (teamsRes.data || []).map((t: any) => t.id as string);
  const directCenterIds = (centersRes.data || []).map((c: any) => c.id as string);

  // Si el manager dirige un centro, también ve todos los equipos de ese centro
  // (aunque cada equipo tenga su propio sub-manager).
  let teamIdsFromCenters: string[] = [];
  if (directCenterIds.length > 0) {
    const { data: centerTeams } = await supabase
      .from("teams")
      .select("id")
      .eq("company_id", companyId)
      .in("center_id", directCenterIds);
    teamIdsFromCenters = (centerTeams || []).map((t: any) => t.id as string);
  }

  const allTeamIds = Array.from(new Set([...directTeamIds, ...teamIdsFromCenters]));
  const allCenterIds = directCenterIds;

  // Localizar los usuarios cuyos profiles caen dentro de esos teams/centers
  let userIds: string[] = [managerId]; // siempre incluye al propio manager
  if (allTeamIds.length > 0 || allCenterIds.length > 0) {
    const orParts: string[] = [];
    if (allTeamIds.length > 0) orParts.push(`team_id.in.(${allTeamIds.join(",")})`);
    if (allCenterIds.length > 0) orParts.push(`center_id.in.(${allCenterIds.join(",")})`);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .or(orParts.join(","));
    if (profiles) {
      for (const p of profiles as any[]) {
        userIds.push(p.id as string);
      }
    }
  }

  return {
    teamIds: allTeamIds,
    centerIds: allCenterIds,
    userIds: Array.from(new Set(userIds)),
  };
}

/**
 * True if the user has any team/center assigned as manager. False if they
 * are technically "manager" role but haven't been assigned to anything yet
 * (in that case they should see nothing, not everything).
 */
export function isManagerScopeEmpty(scope: ManagerScope): boolean {
  return scope.teamIds.length === 0 && scope.centerIds.length === 0;
}
