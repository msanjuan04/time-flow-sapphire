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

export type Role = "owner" | "admin" | "manager" | "worker";

export interface MembershipCompany {
  id: string;
  name?: string | null;
  status?: string | null;
  plan?: string | null;
  logo_url?: string | null;
  keep_sessions_open?: boolean | null;
}

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
  signInWithCode: (code: string, options?: { redirect?: string | null }) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "gtiq_auth";
const TOKENS_KEY = "gtiq_tokens";

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!envSupabaseUrl) {
  throw new Error("Falta VITE_SUPABASE_URL en .env");
}

if (!envAnonKey) {
  throw new Error("Falta VITE_SUPABASE_ANON_KEY en .env");
}

const SUPABASE_BASE_URL = envSupabaseUrl.replace(/\/$/, "");
const SUPABASE_ANON_KEY = envAnonKey;

// -------------------------------------------------------------------------
//   FIX IMPORTANTE: función memberships con SELECT CORRECTO
// -------------------------------------------------------------------------
const fetchMembershipsWithCompany = async (userId: string) => {
  console.log("[auth] fetchMembershipsWithCompany:start", { userId });

  const { data, error } = await supabase
    .from("memberships")
    .select(`
      id,
      company_id,
      role,
      company:companies(
        id,
        name,
        status,
        plan,
        logo_url,
        keep_sessions_open
      )
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("[auth] fetchMembershipsWithCompany:error", error);
    throw error;
  }

  const list = (data ?? []) as Membership[];

  const companyRaw = list[0]?.company ?? null;
  const activeCompany = companyRaw
    ? {
        id: companyRaw.id,
        name: companyRaw.name ?? null,
        status: companyRaw.status ?? null,
        plan: companyRaw.plan ?? null,
        logo_url: companyRaw.logo_url ?? null,
        keep_sessions_open: companyRaw.keep_sessions_open ?? null,
      }
    : null;

  console.log("[auth] fetchMembershipsWithCompany:success", {
    count: list.length,
    activeCompany,
  });

  return { list, activeCompany };
};

// -------------------------------------------------------------------------

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearStoredAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKENS_KEY);
    setUser(null);
    setMemberships([]);
    setCompany(null);
  };

  // ---------------------------------------------------------------------
  // INIT SESSION
  // ---------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      console.log("[auth] init:getSession:start");

      let { data } = await supabase.auth.getSession();
      let session = data.session;

      console.log("[auth] init:getSession:result", {
        hasSession: !!session,
      });

      // Si no hay sesión, intentar cargar tokens guardados
      if (!session) {
        const saved = localStorage.getItem(TOKENS_KEY);
        if (saved) {
          const tokens = JSON.parse(saved) as AuthTokens;
          const r = await supabase.auth.setSession(tokens);
          session = r.data.session;
        }
      }

      if (!session) {
        if (mounted) setLoading(false);
        return;
      }

      // Cargar memberships
      const uid = session.user.id;
      const { list, activeCompany } = await fetchMembershipsWithCompany(uid);

      // Fallback: leer perfil para asegurar flag de superadmin y nombre
      let profileSuperadmin = false;
      let profileFullName: string | null = null;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_superadmin, full_name")
          .eq("id", uid)
          .maybeSingle();
        profileSuperadmin = profile?.is_superadmin ?? false;
        profileFullName = profile?.full_name ?? null;
      } catch (err) {
        console.error("[auth] profile load failed", err);
      }

      const userData: AuthUser = {
        id: uid,
        email: session.user.email ?? null,
        full_name: (session.user.user_metadata as any)?.full_name ?? profileFullName ?? null,
        is_superadmin:
          (session.user.user_metadata as any)?.is_superadmin ?? profileSuperadmin ?? false,
      };

      setUser(userData);
      setMemberships(list);
      setCompany(activeCompany);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: userData,
          memberships: list,
          company: activeCompany,
        })
      );

      if (mounted) setLoading(false);
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------------------------------------------------------------------
  // SIGN IN WITH CODE
  // ---------------------------------------------------------------------
  const signInWithCode = async (code: string, options?: { redirect?: string | null }) => {
    const normalized = code.replace(/\D/g, "").trim();
    if (!/^\d{6}$/.test(normalized)) return { error: "INVALID_CODE_FORMAT" };

    console.log("Attempting login with code:", normalized);

    const r = await fetch(`${SUPABASE_BASE_URL}/functions/v1/login-with-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ code: normalized }),
    });

    const payload = await r.json().catch(() => ({
      success: false,
      error: "BAD_RESPONSE",
    }));

    console.log("Login response:", {
      success: payload?.success,
      hasTokens: !!payload?.access_token,
    });

    if (!r.ok || !payload.success) return { error: payload.error || "LOGIN_FAILED" };

    // Direct tokens
    if (payload.access_token && payload.refresh_token) {
      const set = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });

      if (set.error) {
        console.error("Failed to set session:", set.error);
        return { error: "SESSION_SET_FAILED" };
      }
    }

    // Obtener de nuevo la sesión ya válida
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) return { error: "SESSION_VERIFICATION_FAILED" };

    localStorage.setItem(
      TOKENS_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
    );

    // Cargar memberships
    const { list, activeCompany } = await fetchMembershipsWithCompany(session.user.id);

    // Refrescar flag superadmin desde perfiles para no depender solo de user_metadata
    let profileSuperadmin = false;
    let profileFullName: string | null = null;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin, full_name")
        .eq("id", session.user.id)
        .maybeSingle();
      profileSuperadmin = profile?.is_superadmin ?? false;
      profileFullName = profile?.full_name ?? null;
    } catch (err) {
      console.error("[auth] profile load failed (signin)", err);
    }

    const userData: AuthUser = {
      id: session.user.id,
      email: session.user.email ?? null,
      full_name: (session.user.user_metadata as any)?.full_name ?? profileFullName ?? null,
      is_superadmin:
        (session.user.user_metadata as any)?.is_superadmin ?? profileSuperadmin ?? false,
    };

    const nextState = {
      user: userData,
      memberships: list,
      company: activeCompany,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));

    setUser(userData);
    setMemberships(list);
    setCompany(activeCompany);

    const targetRoute =
      options && Object.prototype.hasOwnProperty.call(options, "redirect")
        ? options.redirect
        : null;
    if (targetRoute) {
      navigate(targetRoute);
    } else {
      const route = resolveDefaultRoute(userData, list, activeCompany);
      navigate(route.route);
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearStoredAuth();
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, memberships, company, loading, signInWithCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
