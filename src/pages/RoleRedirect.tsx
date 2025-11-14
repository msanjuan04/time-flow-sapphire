import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { resolveDefaultRoute } from "@/lib/routeResolver";
import { Loader2 } from "lucide-react";

const RoleRedirect = () => {
  const { user, memberships, company, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    const resolved = resolveDefaultRoute(user, memberships, company);
    if (resolved.route === "/access-issue" && "reason" in resolved) {
      navigate(`/access-issue?reason=${resolved.reason}`, { replace: true });
    } else {
      navigate(resolved.route, { replace: true });
    }
  }, [user, memberships, company, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/20">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground text-sm">Preparando tu espacio...</p>
    </div>
  );
};

export default RoleRedirect;
