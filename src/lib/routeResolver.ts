import type { AuthUser, Membership, Company } from "@/contexts/AuthContext";

export type ResolvedRoute =
  | { route: string }
  | { route: "/access-issue"; reason: "no-membership" | "no-company" | "no-role" };

const ACCESS_ROUTE = "/access-issue";

export function resolveDefaultRoute(
  user: AuthUser | null,
  memberships: Membership[],
  company: Company | null
): ResolvedRoute {
  if (!user) {
    return { route: "/auth" };
  }

  if (user.is_superadmin) {
    return { route: "/admin" };
  }

  const primaryMembership = memberships[0];
  if (!primaryMembership) {
    return { route: ACCESS_ROUTE, reason: "no-membership" };
  }

  if (!company) {
    return { route: ACCESS_ROUTE, reason: "no-company" };
  }

  if (["owner", "admin", "manager"].includes(primaryMembership.role)) {
    return { route: "/dashboard" };
  }

  if (primaryMembership.role === "worker") {
    return { route: "/me/clock" };
  }

  return { route: ACCESS_ROUTE, reason: "no-role" };
}
