import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, QrCode, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Device {
  id: string;
  company_id: string;
  name: string;
  center_id: string | null;
}

interface Employee {
  id: string;
  full_name: string | null;
  email: string | null;
  login_code: string | null;
  avatar_url?: string | null;
}

const KioskFree = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pin, setPin] = useState(searchParams.get("pin") || "");
  const [device, setDevice] = useState<Device | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [modeWarning, setModeWarning] = useState<string | null>(null);

  useEffect(() => {
    if (pin) {
      handlePinSubmit(pin, { silent: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePinSubmit = async (pinValue?: string, options?: { silent?: boolean }) => {
    const pinToUse = (pinValue ?? pin).trim().toUpperCase();
    if (!pinToUse) {
      toast.error("Ingresa el PIN del kiosko");
      return;
    }
    setLoading(true);
    setModeWarning(null);
    try {
      const { data: deviceData, error } = await supabase
        .from("devices")
        .select("id, company_id, name, center_id")
        .eq("secret_hash", pinToUse)
        .eq("type", "kiosk")
        .maybeSingle();

      if (error) throw error;
      if (!deviceData) {
        toast.error("PIN incorrecto");
        setDevice(null);
        return;
      }

      const { data: companyData } = await supabase
        .from("companies")
        .select("kiosk_mode")
        .eq("id", deviceData.company_id)
        .maybeSingle();

      if (companyData?.kiosk_mode === "auth") {
        setModeWarning("Este kiosko está configurado en modo autenticado. Activa el modo libre en la empresa para usar este flujo.");
      }

      setDevice(deviceData);
      setPin(pinToUse);
      if (!options?.silent) {
        toast.success(`Kiosko listo: ${deviceData.name}`);
      }
      await loadEmployees(deviceData.company_id);
    } catch (err) {
      console.error("Error al validar PIN:", err);
      toast.error("No pudimos validar el PIN");
      setDevice(null);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async (companyId: string) => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, login_code, memberships!inner(company_id)")
        .eq("memberships.company_id", companyId)
        .order("full_name", { ascending: true });

      if (error) throw error;
      const filtered = (data || []).filter((e) => e.login_code);
      setEmployees(filtered as Employee[]);
    } catch (err) {
      console.error("Error cargando empleados:", err);
      toast.error("No pudimos cargar los empleados");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const term = search.toLowerCase();
    return employees.filter((e) =>
      (e.full_name || "").toLowerCase().includes(term) ||
      (e.email || "").toLowerCase().includes(term) ||
      (e.login_code || "").toLowerCase().includes(term)
    );
  }, [employees, search]);

  const handleEmployeeNavigate = (employee: Employee) => {
    if (!employee.login_code) {
      toast.error("Este empleado no tiene código asignado");
      return;
    }
    const base = `/kiosk/employee/${employee.login_code}`;
    const target = pin ? `${base}?device=${pin}` : base;
    navigate(target);
  };

  const parseTokenFromText = (text: string) => {
    const match = text.match(/\/kiosk\/employee\/([A-Za-z0-9_-]+)/);
    return match?.[1] || null;
  };

  const handleScanQR = async () => {
    const manual = prompt("Escanea o pega el contenido del QR");
    if (!manual) return;
    const token = parseTokenFromText(manual) || manual.trim();
    if (!token) {
      toast.error("No pudimos leer el QR");
      return;
    }
    const base = `/kiosk/employee/${token}`;
    const target = pin ? `${base}?device=${pin}` : base;
    navigate(target);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-6xl mx-auto space-y-6 pt-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover-scale">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Modo Kiosko Libre</h1>
            <p className="text-sm text-muted-foreground">
              No requiere login de empleados. Selecciona un trabajador o escanea su QR.
            </p>
          </div>
        </div>

        <Card className="glass-card p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">PIN del dispositivo (4-6 dígitos)</label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="Ej. 5H7U4I"
                className="text-lg font-mono tracking-widest"
              />
            </div>
            <Button
              className="w-full md:w-48"
              onClick={() => handlePinSubmit()}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Activar kiosko
            </Button>
            <Button
              variant="outline"
              className="w-full md:w-48"
              onClick={handleScanQR}
              disabled={!device}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Escanear QR
            </Button>
          </div>
          {modeWarning && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 p-2 rounded">
              {modeWarning}
            </p>
          )}
        </Card>

        {device && (
          <Card className="glass-card p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Dispositivo</p>
                <h2 className="text-xl font-semibold">{device.name}</h2>
                <p className="text-sm text-muted-foreground">PIN {pin}</p>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o código"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-60"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {loadingEmployees ? (
                <div className="col-span-full flex justify-center py-6 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Cargando empleados...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="col-span-full text-center text-muted-foreground py-6">
                  No hay empleados con código asignado.
                </p>
              ) : (
                filteredEmployees.map((emp) => (
                  <motion.div
                    key={emp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-4 flex items-center gap-3 hover-scale cursor-pointer" onClick={() => handleEmployeeNavigate(emp)}>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={emp.avatar_url || undefined} alt={emp.full_name || ""} />
                        <AvatarFallback>{(emp.full_name || emp.email || "??").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold leading-tight">{emp.full_name || emp.email}</p>
                        <p className="text-xs text-muted-foreground break-all">{emp.email}</p>
                        <p className="text-xs font-mono text-primary mt-1">Código: {emp.login_code}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default KioskFree;
