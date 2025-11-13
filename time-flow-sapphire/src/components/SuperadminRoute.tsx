import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { Loader2 } from "lucide-react";

interface SuperadminRouteProps {
  children: React.ReactNode;
}

export const SuperadminRoute = ({ children }: SuperadminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperadmin, loading: superadminLoading } = useSuperadmin();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for both auth and superadmin checks to complete
    if (!authLoading && !superadminLoading) {
      // If no user session, redirect to login
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }

      // If user exists but is not superadmin, redirect to home
      if (!isSuperadmin) {
        navigate("/", { replace: true });
      }
    }
  }, [user, isSuperadmin, authLoading, superadminLoading, navigate]);

  // Show loading state while checking
  if (authLoading || superadminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // If no user, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user exists but is not superadmin, redirect to home
  if (!isSuperadmin) {
    return <Navigate to="/" replace />;
  }

  // User is superadmin, render protected content
  return <>{children}</>;
};
