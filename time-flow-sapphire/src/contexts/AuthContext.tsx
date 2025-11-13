import { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signInWithCode: (code: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithCode = async (code: string) => {
    try {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean;
        user?: { id: string; email: string };
        auth_code?: string;
        token?: string; // Mantener por compatibilidad
        type?: "magiclink" | "recovery" | string;
        error?: string;
      }>("login-with-code", {
        body: { code },
      });

      if (error) {
        console.error("Login code function error:", error);
        return { error: new Error(error.message || "No se pudo validar el código") };
      }

      if (data?.error || !data?.success) {
        return { error: new Error(data?.error || "Código incorrecto o usuario no encontrado") };
      }

      // Si tenemos access_token y refresh_token directamente, usarlos
      if (data?.access_token && data?.refresh_token) {
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });

          if (sessionError) {
            console.error("Set session error:", sessionError);
            return { error: sessionError };
          }

          if (sessionData.session) {
            setSession(sessionData.session);
            setUser(sessionData.session.user ?? null);
            return { error: null };
          }
        } catch (err) {
          console.error("Error setting session:", err);
          return { error: err instanceof Error ? err : new Error("Error al establecer sesión") };
        }
      }

      // Si no, intentar usar verifyOtp como fallback
      const token = data?.token || data?.auth_code;
      const tokenType = data?.type || 'magiclink';
      
      if (token && typeof token === 'string') {
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
            token: token,
            type: tokenType as 'magiclink' | 'email',
            email: data?.user?.email || '',
          });

          if (sessionError) {
            console.error("Verify OTP error:", sessionError);
            return { error: sessionError };
          }

          if (sessionData.session) {
            setSession(sessionData.session);
            setUser(sessionData.session.user ?? null);
            return { error: null };
          }
        } catch (err) {
          console.error("Error verifying OTP:", err);
          return { error: err instanceof Error ? err : new Error("Error al verificar token") };
        }
      }

      return { error: new Error("No se pudo crear la sesión. Intenta de nuevo.") };
    } catch (err) {
      console.error("Unexpected code login error:", err);
      return { error: err instanceof Error ? err : new Error("Error inesperado al iniciar sesión") };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, signInWithCode, signUp, signOut, loading }}>
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
