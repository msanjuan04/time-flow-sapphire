import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AuthUser {
  id: string;
  email: string | null;
  full_name: string | null;
  is_superadmin?: boolean;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface MembershipCompany {
  id: string;
  name?: string | null;
}

type Role = "owner" | "admin" | "manager" | "worker";

interface Membership {
  id: string;
  company_id: string;
  role: Role;
  company?: MembershipCompany | null;
}

interface Company {
  id: string;
  name: string | null;
  status: string | null;
  plan: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  memberships: Membership[];
  company: Company | null;
  loading: boolean;
  signInWithCode: (code: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "gtiq_auth";
const TOKENS_KEY = "gtiq_tokens";
const SUPABASE_BASE_URL = (import.meta.env.VITE_SUPABASE_URL || "https://fyyhkdishlythkdnojdh.supabase.co").replace(/\/$/, "");

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setUser(parsed.user ?? null);
        setMemberships(parsed.memberships ?? []);
        setCompany(parsed.company ?? null);
        
        // Restore Supabase session if tokens exist
        const tokensStr = localStorage.getItem(TOKENS_KEY);
        if (tokensStr) {
          const tokens = JSON.parse(tokensStr);
          if (tokens.access_token && tokens.refresh_token) {
            console.log("Restoring Supabase session from storage");
            supabase.auth.setSession({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
            }).then(() => {
              console.log("Session restored successfully");
            }).catch((err) => {
              console.error("Failed to restore session:", err);
              localStorage.removeItem(TOKENS_KEY);
            });
          }
        }
      } catch (error) {
        console.warn("Failed to parse cached auth state", error);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKENS_KEY);
      }
    }
    setLoading(false);
  }, []);

  const persistState = (next: {
    user: AuthUser | null;
    memberships: Membership[];
    company: Company | null;
  }) => {
    if (!next.user) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKENS_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const persistTokens = (tokens: AuthTokens | null) => {
    if (!tokens) {
      localStorage.removeItem(TOKENS_KEY);
      return;
    }
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  };

  const signInWithCode = async (code: string): Promise<{ error: string | null }> => {
    if (!/^\d{6}$/.test(code)) {
      return { error: "INVALID_CODE_FORMAT" };
    }

    try {
      console.log("Attempting login with code:", code);
      const response = await fetch(`${SUPABASE_BASE_URL}/functions/v1/login-with-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const payload = await response
        .json()
        .catch(() => ({ success: false, error: "Respuesta inválida del servidor" }));

      console.log("Login response:", { success: payload?.success, hasTokens: !!(payload?.access_token) });

      if (!response.ok || !payload?.success) {
        const errorCode = typeof payload?.error === "string" ? payload.error : "LOGIN_FAILED";
        return { error: errorCode };
      }

      if (!payload.user) {
        return { error: "USER_NOT_FOUND" };
      }

      // If we received a hashed_token, verify it to get proper session
      if (payload.hashed_token) {
        console.log("Verifying hashed token to establish session");
        
        const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: payload.hashed_token,
          type: 'magiclink',
        });

        if (verifyError || !sessionData.session) {
          console.error("Failed to verify token:", verifyError);
          return { error: "SESSION_VERIFICATION_FAILED" };
        }

        console.log("Session established successfully via token verification");
        
        // Session is now established in Supabase client
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Verified session:", {
          hasSession: !!session,
          userId: session?.user?.id,
          hasAccessToken: !!session?.access_token
        });
      }

      const userData: AuthUser = {
        id: payload.user.id,
        email: payload.user.email ?? null,
        full_name: payload.user.full_name ?? null,
        is_superadmin: payload.user.is_superadmin ?? false,
      };

      const membershipsData: Membership[] = ((payload.memberships as Membership[]) || []).map((m) => ({
        id: m.id,
        company_id: m.company_id,
        role: m.role as Role,
        company: m.company ?? null,
      }));

      const companyData: Company | null = payload.company
        ? {
            id: payload.company.id,
            name: payload.company.name ?? null,
            status: payload.company.status ?? null,
            plan: payload.company.plan ?? null,
          }
        : null;

      const nextState = {
        user: userData,
        memberships: membershipsData,
        company: companyData,
      };

      setUser(nextState.user);
      setMemberships(nextState.memberships);
      setCompany(nextState.company ?? null);
      persistState(nextState);

      // Get the current session (should be set by verifyOtp)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log("Storing session tokens");
        persistTokens({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }

      navigate("/");

      return { error: null };
    } catch (error) {
      console.error("Unexpected code login error:", error);
      return {
        error: "NETWORK_ERROR",
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMemberships([]);
    setCompany(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKENS_KEY);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, memberships, company, loading, signInWithCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
