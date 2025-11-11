import { useEffect } from "react";
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
  const { role, loading: membershipLoading } = useMembership();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || membershipLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role) {
    return <Onboarding onComplete={() => window.location.reload()} />;
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
