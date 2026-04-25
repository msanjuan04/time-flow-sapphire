import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ArrowRight,
  Lock,
  KeyRound,
  Settings as SettingsIcon,
  QrCode,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { OfflineClockIndicator } from "@/components/OfflineClockIndicator";

const PIN_STORAGE_KEY = "kiosk_device_pin_v1";
const DEVICE_NAME_KEY = "kiosk_device_name_v1";

const KioskFree = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useDocumentTitle("Kiosko • GTiQ");

  const initialPin =
    searchParams.get("pin") ||
    (typeof window !== "undefined" ? localStorage.getItem(PIN_STORAGE_KEY) || "" : "");

  const [devicePin, setDevicePin] = useState(initialPin);
  const [deviceName, setDeviceName] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem(DEVICE_NAME_KEY) || "" : ""
  );
  const [pinDialogOpen, setPinDialogOpen] = useState(!initialPin);
  const [pinDraft, setPinDraft] = useState(initialPin);
  const [validatingPin, setValidatingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!devicePin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("devices")
        .select("name")
        .eq("secret_hash", devicePin)
        .eq("type", "kiosk")
        .maybeSingle();
      if (!cancelled && data?.name) {
        setDeviceName(data.name);
        localStorage.setItem(DEVICE_NAME_KEY, data.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [devicePin]);

  const handleValidatePin = async () => {
    const pin = pinDraft.trim().toUpperCase();
    if (!pin) {
      setPinError("Introduce el PIN del dispositivo");
      return;
    }
    setValidatingPin(true);
    setPinError(null);
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("id, company_id, name")
        .eq("secret_hash", pin)
        .eq("type", "kiosk")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setPinError("PIN incorrecto");
        return;
      }
      localStorage.setItem(PIN_STORAGE_KEY, pin);
      localStorage.setItem(DEVICE_NAME_KEY, data.name);
      setDevicePin(pin);
      setDeviceName(data.name);
      setPinDialogOpen(false);
      toast.success(`Kiosko ${data.name} activado`);
    } catch (err) {
      console.error("Error validando PIN:", err);
      setPinError("No pudimos validar el PIN");
    } finally {
      setValidatingPin(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devicePin) {
      setPinDialogOpen(true);
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      toast.error("Introduce un código de 6 dígitos");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, login_code")
        .eq("login_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Código no reconocido");
        setCode("");
        setSubmitting(false);
        return;
      }
      navigate(`/kiosk/employee/${code}?device=${devicePin}`);
    } catch (err) {
      console.error("Error verificando código:", err);
      toast.error("No pudimos verificar el código");
      setSubmitting(false);
    }
  };

  const handleScanQR = () => {
    const manual = prompt("Escanea o pega el contenido del QR");
    if (!manual) return;
    const match = manual.match(/\/kiosk\/employee\/([A-Za-z0-9_-]+)/);
    const token = match?.[1] || manual.trim();
    if (!token) {
      toast.error("No pudimos leer el QR");
      return;
    }
    const target = devicePin
      ? `/kiosk/employee/${token}?device=${devicePin}`
      : `/kiosk/employee/${token}`;
    navigate(target);
  };

  const features = [
    {
      icon: KeyRound,
      title: "Solo tu código",
      desc: "6 dígitos personales y listo. Sin contraseñas, sin esperas.",
    },
    {
      icon: Zap,
      title: "Ficha en 2 segundos",
      desc: "Entrada, pausa o salida con un toque. Cierre automático para el siguiente.",
    },
    {
      icon: ShieldCheck,
      title: "100% RGPD",
      desc: "Datos cifrados, alojados en Europa y conformes con la normativa española.",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-[140px] bg-primary"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-48 -left-48 w-[700px] h-[700px] rounded-full opacity-[0.06] blur-[160px] bg-primary"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"
      />

      {/* Top-right utilities */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <OfflineClockIndicator />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setPinDraft(devicePin);
            setPinDialogOpen(true);
          }}
          title="Configurar dispositivo"
        >
          <SettingsIcon className="w-4 h-4" />
        </Button>
      </div>

      <div className="relative min-h-screen grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hidden lg:flex flex-col justify-between p-10 xl:p-14"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-110" />
              <img
                src="/logo.png"
                alt="GTiQ Logo"
                className="relative w-12 h-12 object-contain"
              />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight block leading-none">
                GTiQ
              </span>
              {deviceName && (
                <span className="text-xs text-muted-foreground">
                  {deviceName}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-8 max-w-xl">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Kiosko de fichaje
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1]">
                Introduce tu{" "}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  código personal.
                </span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Ficha entrada, pausa o salida en segundos. Al terminar, la
                sesión se cierra automáticamente para el siguiente compañero.
              </p>
            </div>

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

          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-10 h-10 rounded-xl bg-background/60 backdrop-blur-md border border-border/60 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest">Ahora</p>
              <p className="text-sm font-medium text-foreground tabular-nums">
                {format(now, "HH:mm:ss")} ·{" "}
                {format(now, "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
        </motion.section>

        {/* FORM */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="flex items-center justify-center p-5 sm:p-8 lg:p-10"
        >
          <div className="w-full max-w-md">
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
                {deviceName || "Kiosko de fichaje"}
              </p>
            </div>

            <div className="relative lg:pt-7">
              <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-0 z-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/40 blur-xl rounded-full animate-pulse" />
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

              <div
                className="relative rounded-3xl p-[1px] overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--border) / 0.4) 40%, hsl(var(--border) / 0.2))",
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary/20 blur-3xl"
                />

                <div className="relative rounded-[calc(1.5rem-1px)] bg-background/85 backdrop-blur-xl p-7 sm:p-9 lg:pt-12 space-y-6">
                  <div className="text-center space-y-1.5">
                    <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight">
                      Hola
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Introduce tu código personal para fichar
                    </p>
                  </div>

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
                          Continuar
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full h-11"
                      onClick={handleScanQR}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Escanear QR
                    </Button>
                  </form>

                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      <span>Conexión cifrada · Datos protegidos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-6 px-4 leading-relaxed">
              ¿Has olvidado tu código? Pídelo al responsable de tu empresa.
            </p>
          </div>
        </motion.section>
      </div>

      {/* Pin setup dialog */}
      <Dialog
        open={pinDialogOpen}
        onOpenChange={(open) => {
          if (!open && !devicePin) return; // bloqueado hasta que haya PIN
          setPinDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar dispositivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Introduce el PIN del dispositivo (lo encuentras en Ajustes →
              Dispositivos). Solo se pide la primera vez.
            </p>
            <Input
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Ej. 5H7U4I"
              className="text-lg font-mono tracking-widest"
              autoFocus
            />
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
          </div>
          <DialogFooter>
            <Button
              onClick={handleValidatePin}
              disabled={validatingPin}
              className="w-full"
            >
              {validatingPin ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              Activar kiosko
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KioskFree;
