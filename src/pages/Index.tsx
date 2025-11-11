import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import WorkerView from "@/components/WorkerView";
import ManagerView from "@/components/ManagerView";
import AdminView from "@/components/AdminView";
import Onboarding from "@/components/Onboarding";
import { Loader2 } from "lucide-react";
import { useSuperadmin } from "@/hooks/useSuperadmin";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, companyId, loading: membershipLoading } = useMembership();
  const { isSuperadmin, loading: superLoading } = useSuperadmin();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Wait for both auth and membership to load
    if (authLoading || membershipLoading || superLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    // Superadmin: ir al panel admin y no iniciar onboarding
    if (isSuperadmin) {
      navigate("/admin");
      return;
    }

    // If user has no company, show onboarding
    if (!companyId) {
      setShowOnboarding(true);
    }
  }, [user, companyId, isSuperadmin, authLoading, membershipLoading, superLoading, navigate]);

  if (authLoading || membershipLoading || superLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showOnboarding || !companyId) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  if (!role) {
    return null;
  }

  if (role === "worker") {
    return <WorkerView />;
  }

  if (role === "manager") {
    return <ManagerView />;
  }

  // Owner and Admin
  return <AdminView />;
};

export default Index;
