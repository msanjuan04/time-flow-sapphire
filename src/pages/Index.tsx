import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import WorkerView from "@/components/WorkerView";
import ManagerView from "@/components/ManagerView";
import AdminView from "@/components/AdminView";
import Onboarding from "@/components/Onboarding";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, companyId, loading: membershipLoading } = useMembership();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Wait for both auth and membership to load
    if (authLoading || membershipLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    // If user has no company, show onboarding
    if (!companyId) {
      setShowOnboarding(true);
    }
  }, [user, companyId, authLoading, membershipLoading, navigate]);

  if (authLoading || membershipLoading) {
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
