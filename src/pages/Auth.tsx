import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Zap, Clock, Sparkles, ArrowRight, Lock, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { RecoverAccessDialog } from "@/components/RecoverAccessDialog";

const Auth = () => {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const { signInWithCode, user, loading } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle("Iniciar sesión • GTiQ");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      toast.error("Introduce un código de 6 dígitos");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await signInWithCode(code);
      if (error) {
        const message = error === "INVALID_CODE"
          ? "Código incorrecto o expirado"
          : error === "INVALID_CODE_FORMAT"
            ? "El código debe tener 6 dígitos"
            : error === "SESSION_VERIFICATION_FAILED"
              ? "No se pudo verificar la sesión. Intenta de nuevo."
            : error === "SESSION_SET_FAILED"
              ? "No se pudo establecer la sesión. Intenta de nuevo."
            : error === "NO_SESSION_TOKENS"
              ? "No se recibieron tokens de sesión. Intenta de nuevo."
            : error === "NETWORK_ERROR"
              ? "Error de conexión. Verifica tu internet e intenta de nuevo."
            : "No se pudo crear la sesión. Intenta de nuevo.";
        toast.error(message);
        setSubmitting(false);
        return;
      }

      toast.success("¡Bienvenido de nuevo!");
      // La navegación se maneja en AuthContext
    } catch (error) {
      console.error("Error inesperado en login:", error);
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
      setSubmitting(false);
    }
  };

  const features = [
    {
      icon: ShieldCheck,
      title: "Sin contraseñas",
      desc: "Solo tu código personal de 6 dígitos. Olvídate de recordar passwords.",
    },
    {
      icon: Zap,
      title: "Acceso en 1 segundo",
      desc: "Ficha entrada y salida al instante, desde cualquier dispositivo.",
    },
    {
      icon: ShieldCheck,
      title: "100% RGPD",
      desc: "Tus datos cifrados y alojados en Europa. Cumplimiento legal garantizado.",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* ── Orbes de luz ambiente ──────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-[140px] bg-primary"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-48 -left-48 w-[700px] h-[700px] rounded-full opacity-[0.06] blur-[160px] bg-primary"
      />

      {/* ── Grid pattern sutil ─────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"
      />

      <div className="relative min-h-screen grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
        {/* ══════════════ HERO (izquierda en desktop) ══════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hidden lg:flex flex-col justify-between p-10 xl:p-14"
        >
          {/* Top: logo + marca */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-110" />
              <img
                src="/logo.png"
                alt="GTiQ Logo"
                className="relative w-12 h-12 object-contain"
              />
            </div>
            <span className="text-2xl font-bold tracking-tight">GTiQ</span>
          </div>

          {/* Middle: tagline + descripción + features */}
          <div className="space-y-8 max-w-xl">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Control horario simplificado
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1]">
                Tu tiempo,{" "}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  bajo control.
                </span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Ficha, gestiona ausencias y genera informes legales en
                segundos. Diseñado para equipos que valoran su tiempo tanto
                como tú.
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-4">
              {features.map((feat, i) => (
                <motion.li
                  key={feat.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <feat.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{feat.title}</p>
                    <p className="text-sm text-muted-foreground">{feat.desc}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Bottom: reloj live */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-10 h-10 rounded-xl bg-background/60 backdrop-blur-md border border-border/60 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest">Ahora</p>
              <p className="text-sm font-medium text-foreground tabular-nums">
                {format(now, "HH:mm:ss")} · {format(now, "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ══════════════ FORM (derecha en desktop, full en mobile) ══════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="flex items-center justify-center p-5 sm:p-8 lg:p-10"
        >
          <div className="w-full max-w-md">
            {/* Logo + título solo en mobile */}
            <div className="lg:hidden text-center mb-8">
              <div className="relative inline-block mb-3">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-110" />
                <img
                  src="/logo.png"
                  alt="GTiQ Logo"
                  className="relative w-16 h-16 object-contain mx-auto"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">GTiQ</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Tu tiempo, bajo control.
              </p>
            </div>

            {/* ══════════════ Card del formulario — visual ══════════════ */}
            <div className="relative lg:pt-7">
              {/* Icono flotante — solo en desktop (en móvil ya hay logo arriba) */}
              <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-0 z-10">
                <div className="relative">
                  {/* Halo animado */}
                  <div className="absolute inset-0 bg-primary/40 blur-xl rounded-full animate-pulse" />
                  {/* Badge con gradient */}
                  <div
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 border border-primary/30"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                    }}
                  >
                    <KeyRound className="w-6 h-6 text-white" strokeWidth={2.2} />
                  </div>
                </div>
              </div>

              {/* Card con gradient border simulado */}
              <div
                className="relative rounded-3xl p-[1px] overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--border) / 0.4) 40%, hsl(var(--border) / 0.2))",
                }}
              >
                {/* Brillo decorativo top-right */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary/20 blur-3xl"
                />

                <div className="relative rounded-[calc(1.5rem-1px)] bg-background/85 backdrop-blur-xl p-7 sm:p-9 lg:pt-12 space-y-6">
                  {/* Título */}
                  <div className="text-center space-y-1.5">
                    <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight">
                      Bienvenido de vuelta
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Introduce tu código personal
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border/60" />
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                          Código de 6 dígitos
                        </p>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border/60" />
                      </div>

                      <InputOTP
                        value={code}
                        onChange={(value) => setCode(value.replace(/\D/g, ""))}
                        maxLength={6}
                        autoFocus
                        containerClassName="justify-center"
                      >
                        <InputOTPGroup className="gap-2">
                          {[...Array(6)].map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="w-11 h-14 sm:w-12 sm:h-14 text-xl font-bold rounded-xl border border-border/60 bg-muted/30 data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/20 data-[active=true]:bg-primary/5 transition-all"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>

                      {/* Progress dots */}
                      <div className="flex items-center justify-center gap-1.5 pt-1">
                        {[...Array(6)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300 ${
                              i < code.length
                                ? "w-5 bg-primary"
                                : "w-1.5 bg-muted-foreground/20"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Botón con icono animado */}
                    <Button
                      type="submit"
                      size="lg"
                      className="group w-full h-12 text-base font-semibold relative overflow-hidden"
                      disabled={submitting || code.length !== 6}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          Entrar
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Recuperar */}
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline font-medium"
                      onClick={() => setRecoverOpen(true)}
                    >
                      ¿No tienes tu código? Recuperar acceso
                    </button>
                  </div>

                  {/* Footer seguridad */}
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      <span>Conexión cifrada · Datos protegidos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal */}
            <p className="text-xs text-center text-muted-foreground mt-6 px-4 leading-relaxed">
              Al iniciar sesión aceptas nuestras políticas de privacidad.
              <br />
              Más info en{" "}
              <a href="/legal" className="underline hover:text-primary">
                Legal y privacidad
              </a>
              .
            </p>
          </div>
        </motion.section>
      </div>

      <RecoverAccessDialog open={recoverOpen} onOpenChange={setRecoverOpen} />
    </div>
  );
};

export default Auth;
