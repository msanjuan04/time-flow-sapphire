import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Calendar, Clock, TrendingUp, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportCSV, printHTML } from "@/lib/exports";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkSession {
  clock_in_time: string;
  clock_out_time: string | null;
  total_work_duration: unknown;
}

const WorkerReports = () => {
  const { user } = useAuth();
  const { companyId, membership } = useMembership();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [totalHours, setTotalHours] = useState(0);
  const [expectedHours, setExpectedHours] = useState(40); // Default 40h/week
  const [sessions, setSessions] = useState<WorkSession[]>([]);

  useEffect(() => {
    if (user && companyId) {
      fetchWorkerData();
    }
  }, [user, companyId, period]);

  const fetchWorkerData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      if (period === "week") {
        // Get start of week (Monday)
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        setExpectedHours(40); // 40h per week
      } else {
        // Get start of month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        setExpectedHours(160); // ~160h per month (4 weeks)
      }

      const { data: sessionsData } = await supabase
        .from("work_sessions")
        .select("clock_in_time, clock_out_time, total_work_duration")
        .eq("user_id", user?.id)
        .eq("company_id", companyId)
        .gte("clock_in_time", startDate.toISOString())
        .order("clock_in_time", { ascending: false });

      setSessions(sessionsData || []);

      // Calculate total hours
      let total = 0;
      sessionsData?.forEach((session) => {
        if (session.clock_in_time && session.clock_out_time) {
          const hours = (new Date(session.clock_out_time).getTime() - 
                        new Date(session.clock_in_time).getTime()) / (1000 * 60 * 60);
          total += hours;
        }
      });

      setTotalHours(total);
    } catch (error) {
      console.error("Error fetching worker data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  // Export helpers (cliente, no tocan backend)
  const exportCSVLocal = () => {
    const headers = ["Fecha", "Entrada", "Salida", "Horas"];
    const rows = sessions.map((s) => {
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : null;
      const hours = start && end ? ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2) : "";
      return [
        start ? start.toISOString().slice(0, 10) : "",
        start ? start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        end ? end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        hours,
      ];
    });
    exportCSV(`mis_horas_${period}`, headers, rows);
    toast.success("CSV exportado");
  };

  const exportPDFLocal = () => {
    const header = `<h1>Mis horas (${period === 'week' ? 'semanal' : 'mensual'})</h1>
      <div class='muted'>${membership?.company.name || 'Empresa'} · ${user?.email || ''} · ${new Date().toLocaleString("es-ES")} · ${sessions.length} fichajes</div>`;
    const rows = sessions.map((s) => {
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : null;
      const hours = start && end ? ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2) : "";
      return `<tr>
        <td>${start ? start.toISOString().slice(0, 10) : ""}</td>
        <td>${start ? start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ""}</td>
        <td>${end ? end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ""}</td>
        <td>${hours}</td>
      </tr>`;
    }).join("");
    const table = `<table><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th></tr></thead><tbody>${rows}</tbody></table>`;
    const signatures = `
      <div style="display:flex;gap:32px;justify-content:space-between;margin-top:24px">
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #cbd5e1; padding-top:6px;">Firma del trabajador</div>
        </div>
        <div style="flex:1;text-align:center">
          <div style="border-top:1px solid #cbd5e1; padding-top:6px;">Firma y sello de la empresa</div>
        </div>
      </div>`;
    printHTML("Mis horas · GTiQ", `${header}${table}${signatures}`);
  };

  const exportPDF = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-worker-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            period,
            userId: user?.id,
            companyId,
          }),
        }
      );

      if (!response.ok) throw new Error('Error generating PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${period}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("PDF generado correctamente");
    } catch (error) {
      toast.error("Error al generar el PDF");
    }
  };

  const hoursRemaining = Math.max(0, expectedHours - totalHours);
  const progress = Math.min(100, (totalHours / expectedHours) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mis Informes</h1>
              <p className="text-sm text-muted-foreground">Control de horas trabajadas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hover-scale">
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSVLocal}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDFLocal}>
                  <FileText className="w-4 h-4 mr-2" /> PDF simple
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF}>
                  <FileText className="w-4 h-4 mr-2" /> PDF avanzado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {/* Period Selector */}
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Período</h2>
            <Select value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Trabajadas</p>
                <p className="text-4xl font-bold mt-1 text-primary">
                  {totalHours.toFixed(1)}h
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Esperadas</p>
                <p className="text-4xl font-bold mt-1">
                  {expectedHours}h
                </p>
              </div>
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Restantes</p>
                <p className={`text-4xl font-bold mt-1 ${hoursRemaining === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  {hoursRemaining.toFixed(1)}h
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="glass-card p-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progreso</span>
              <span className="text-sm text-muted-foreground">{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary/20 rounded-full h-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  progress >= 100 ? 'bg-green-600' : 'bg-primary'
                }`}
              />
            </div>
          </div>
        </Card>

        {/* Recent Sessions */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Fichajes Recientes</h2>
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : sessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay fichajes en este período
              </p>
            ) : (
              sessions.slice(0, 10).map((session, index) => {
                const fmtHM = (ms: number) => {
                  const mins = Math.max(0, Math.round(ms / 60000));
                  const h = Math.floor(mins / 60).toString().padStart(2, '0');
                  const m = (mins % 60).toString().padStart(2, '0');
                  return `${h}:${m}`;
                };
                const date = new Date(session.clock_in_time);
                const durationLabel = session.clock_out_time
                  ? fmtHM(new Date(session.clock_out_time).getTime() - date.getTime())
                  : "En curso";

                return (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 bg-secondary/5 rounded-lg hover:bg-secondary/10 smooth-transition"
                  >
                    <div>
                      <p className="font-medium">
                        {date.toLocaleDateString("es-ES", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        {session.clock_out_time && (
                          <> - {new Date(session.clock_out_time).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{typeof durationLabel === 'string' ? durationLabel : `${durationLabel}`} {durationLabel !== 'En curso' ? 'h' : ''}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WorkerReports;
