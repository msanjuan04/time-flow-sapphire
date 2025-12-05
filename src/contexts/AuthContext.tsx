import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveDefaultRoute } from "@/lib/routeResolver";

export interface AuthUser {
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
  status?: string | null;
  plan?: string | null;
  logo_url?: string | null;
  keep_sessions_open?: boolean | null;
}

export type Role = "owner" | "admin" | "manager" | "worker";

export interface Membership {
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
  logo_url?: string | null;
  keep_sessions_open?: boolean | null;
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
const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!envSupabaseUrl) {
  throw new Error("VITE_SUPABASE_URL no está definido. Revisa tu archivo .env o variables en el hosting.");
}

if (!envAnonKey) {
  throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY no está definido. No se puede inicializar Supabase.");
}

const SUPABASE_BASE_URL = envSupabaseUrl.replace(/\/$/, "");
const SUPABASE_ANON_KEY = envAnonKey;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearStoredAuth = () => {
    setUser(null);
    setMemberships([]);
    setCompany(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKENS_KEY);
  };

  const fetchMembershipsWithCompany = async (userId: string) => {
    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
        id,
        company_id,
        role,
        company:companies(id, name, status, plan, logo_url, keep_sessions_open)
      `
      )
      .eq("user_id", userId);
    if (error) throw error;
    const list = (data || []) as Membership[];
    const activeCompany = list[0]?.company ?? null;
    return { list, activeCompany };
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const savedState = localStorage.getItem(STORAGE_KEY);

        // 1) Intenta leer sesión ya persistida por supabase-js
        let { data } = await supabase.auth.getSession();
        let session = data.session;

        // 2) Si no hay sesión, intenta con tokens guardados manualmente
        if (!session) {
          const savedTokens = localStorage.getItem(TOKENS_KEY);
          if (savedTokens) {
            const tokens = JSON.parse(savedTokens) as AuthTokens;
            const setRes = await supabase.auth.setSession(tokens);
            if (!setRes.error) {
              session = setRes.data.session;
            }
          }
        }

        if (!session) {
          clearStoredAuth();
          if (isMounted) setLoading(false);
          return;
        }

        // Refresca memberships/empresa
        const userId = session.user.id;
        const { list, activeCompany } = await fetchMembershipsWithCompany(userId);

        if (savedState) {
          const parsedState = JSON.parse(savedState) as {
            user: AuthUser | null;
            memberships: Membership[];
            company: Company | null;
          };
          setUser(parsedState.user);
          setMemberships(parsedState.memberships || list);
          setCompany(parsedState.company ?? (activeCompany as Company | null));
        } else {
          setUser({
            id: session.user.id,
            email: session.user.email ?? null,
            full_name: (session.user.user_metadata as any)?.full_name ?? null,
            is_superadmin: (session.user.user_metadata as any)?.is_superadmin ?? false,
          });
          setMemberships(list);
          setCompany((activeCompany as Company) ?? null);
          persistState({
            user: {
              id: session.user.id,
              email: session.user.email ?? null,
              full_name: (session.user.user_metadata as any)?.full_name ?? null,
              is_superadmin: (session.user.user_metadata as any)?.is_superadmin ?? false,
            },
            memberships: list,
            company: (activeCompany as Company) ?? null,
          });
        }

        // Guarda tokens actuales
        persistTokens({
          access_token: session.access_token,
          refresh_token: session.refresh_token ?? "",
        });
      } catch (error) {
        console.warn("Init auth error, clearing stored auth:", error);
        clearStoredAuth();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
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

  // Mantén los tokens actualizados cuando Supabase refresque sesión
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        if (session?.access_token && session?.refresh_token) {
          persistTokens({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
        if (session?.user?.id) {
          try {
            const { list, activeCompany } = await fetchMembershipsWithCompany(session.user.id);
            const userData: AuthUser = {
              id: session.user.id,
              email: session.user.email ?? null,
              full_name: (session.user.user_metadata as any)?.full_name ?? null,
              is_superadmin: (session.user.user_metadata as any)?.is_superadmin ?? false,
            };
            setUser(userData);
            setMemberships(list);
            setCompany((activeCompany as Company) ?? null);
            persistState({
              user: userData,
              memberships: list,
              company: (activeCompany as Company) ?? null,
            });
          } catch (err) {
            console.warn("onAuthStateChange hydrate error:", err);
          }
        }
      }
      if (event === "SIGNED_OUT") {
        clearStoredAuth();
      }
    });
    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, []);

  const signInWithCode = async (code: string): Promise<{ error: string | null }> => {
    if (!/^\d{6}$/.test(code)) {
      return { error: "INVALID_CODE_FORMAT" };
    }

    try {
      console.log("Attempting login with code:", code);
      const response = await fetch(`${SUPABASE_BASE_URL}/functions/v1/login-with-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SUPABASE_ANON_KEY ? {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          } : {}),
        },
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

      const tokenHash = payload.token_hash || payload.hashed_token || null;
      const bareToken = payload.token || null;

      if (payload.access_token && payload.refresh_token) {
        console.log("Setting session with direct tokens");
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        });

        if (sessionError || !sessionData.session) {
          console.error("Failed to set session:", sessionError);
          return { error: "SESSION_SET_FAILED" };
        }

        console.log("Session established successfully with direct tokens");
      } else if (tokenHash || bareToken) {
        console.log("Verifying OTP token to establish session");

        try {
          const verifyPayload: Parameters<typeof supabase.auth.verifyOtp>[0] = tokenHash
            ? {
                type: (payload.verification_type || "magiclink") as "magiclink" | "email" | "recovery",
                token_hash: tokenHash,
              }
            : (() => {
                const email = payload.user?.email;
                if (!email) {
                  throw new Error("Missing email for OTP verification");
                }
                return {
                  type: (payload.verification_type || "magiclink") as "magiclink" | "email" | "recovery",
                  token: bareToken as string,
                  email,
                };
              })();

          const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp(verifyPayload);

          if (verifyError || !sessionData.session) {
            console.error("Failed to verify token:", verifyError);
            return { error: "SESSION_VERIFICATION_FAILED" };
          }
        } catch (verificationError) {
          console.error("OTP verification setup failed:", verificationError);
          return { error: "SESSION_VERIFICATION_FAILED" };
        }

        console.log("Session established successfully via OTP verification");
      } else {
        console.error("No session tokens received from login-with-code");
        return { error: "NO_SESSION_TOKENS" };
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
        company: m.company
          ? {
              id: m.company.id,
              name: (m.company as any).name ?? null,
              status: (m.company as any).status ?? null,
              plan: (m.company as any).plan ?? null,
              logo_url: (m.company as any).logo_url ?? null,
            }
          : null,
      }));

      const companyData: Company | null = payload.company
        ? {
            id: payload.company.id,
            name: payload.company.name ?? null,
            status: payload.company.status ?? null,
            plan: payload.company.plan ?? null,
            logo_url: payload.company.logo_url ?? null,
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

      const resolved = resolveDefaultRoute(nextState.user, nextState.memberships, nextState.company);
      if (resolved.route === "/access-issue" && "reason" in resolved) {
        navigate(`/access-issue?reason=${resolved.reason}`);
      } else {
        navigate(resolved.route);
      }

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
