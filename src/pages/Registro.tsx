import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Loader2, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { extractFunctionErrorMessage } from "@/lib/offlineClockQueue";

/**
 * Alta de empresa en autoservicio.
 *
 * Flujo: formulario → edge function `signup-company` (crea la solicitud en
 * `company_signups` y envía email de verificación) → /registro/verificar
 * con el token → un superadmin aprueba con `admin-resolve-company-signup`.
 *
 * Reconstruida el 2026-09-11 a partir del código desplegado en producción
 * (30/06/2026), que no estaba en el repositorio.
 */

const GlassCard = ({ children }: { children: React.ReactNode }) => (
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
    <div className="relative rounded-[calc(1.5rem-1px)] bg-background/85 backdrop-blur-xl p-7 sm:p-9">
      {children}
    </div>
  </div>
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RegistroPage = () => {
  const navigate = useNavigate();
  useDocumentTitle("Registra tu empresa • GTiQ");

  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [sector, setSector] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return toast.error("Falta el nombre de la empresa");
    if (!fullName.trim()) return toast.error("Falta tu nombre");
    if (!EMAIL_REGEX.test(email.trim())) return toast.error("Email inválido");

    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke("signup-company", {
        body: {
          email: normalizedEmail,
          full_name: fullName.trim(),
          company: {
            name: companyName.trim(),
            tax_id: taxId.trim() || undefined,
            sector: sector.trim() || undefined,
            employee_count: employeeCount ? Number(employeeCount) : undefined,
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
          },
        },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error, data);
        throw new Error(message || "No pudimos registrar tu empresa. Inténtalo de nuevo.");
      }
      setSentTo(normalizedEmail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <GlassCard>
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Revisa tu email</h1>
              <p className="text-sm text-muted-foreground">
                Hemos enviado un enlace de confirmación a
                <br />
                <span className="font-medium text-foreground">{sentTo}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Cuando confirmes tu email revisaremos la solicitud y te avisaremos en cuanto tu empresa
                esté activa.
              </p>
              <Button variant="ghost" className="mt-2" onClick={() => navigate("/auth")}>
                Volver al inicio
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Da de alta tu empresa</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Regístrate y revisaremos tu solicitud. Te avisamos por email cuando esté lista.
          </p>
        </div>

        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="w-4 h-4 text-primary" />
                Datos de la empresa
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre de la empresa *</Label>
                <Input
                  id="name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Mi Empresa S.L."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="taxId">CIF / NIF</Label>
                  <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="B12345678" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sector">Sector</Label>
                  <Input id="sector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Hostelería" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employeeCount">Nº de empleados</Label>
                  <Input
                    id="employeeCount"
                    inputMode="numeric"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    placeholder="12"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="600 000 000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, ciudad, CP"
                />
              </div>
            </div>

            <div className="h-px bg-border/60" />

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="w-4 h-4 text-primary" />
                Responsable de la cuenta
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Tu nombre *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nombre y apellidos"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Tu email *</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  Registrar empresa <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Al registrarte confirmas que tienes autorización para dar de alta a esta empresa.{" "}
              <button type="button" onClick={() => navigate("/legal")} className="underline hover:text-foreground">
                Legal y privacidad
              </button>
            </p>
          </form>
        </GlassCard>

        <div className="text-center mt-5">
          <button
            onClick={() => navigate("/auth")}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ¿Ya tienes cuenta? Entrar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default RegistroPage;
