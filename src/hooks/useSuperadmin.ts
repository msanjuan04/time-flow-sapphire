import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SuperadminStatus {
  isSuperadmin: boolean;
  loading: boolean;
}

export const useSuperadmin = (): SuperadminStatus => {
  const { user } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsSuperadmin(false);
      setLoading(false);
      return;
    }

    setIsSuperadmin(Boolean(user.is_superadmin));
    setLoading(false);
  }, [user]);

  return { isSuperadmin, loading };
};
