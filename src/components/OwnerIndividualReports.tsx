import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Users, X, FileText, Download } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { exportCSV } from "@/lib/exports";
import html2pdf from "html2pdf.js";
import { useAuth } from "@/contexts/AuthContext";

type EventType = Database["public"]["Enums"]["event_type"];
type TimeEventRow = Database["public"]["Tables"]["time_events"]["Row"] & {
  original_event_time?: string | null;
};

interface WorkerOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface OwnerIndividualReportsProps {
  companyId: string;
}

const EVENT_LABELS: Record<EventType, string> = {
  clock_in: "Entrada",
  clock_out: "Salida",
  pause_start: "Pausa",
  pause_end: "Fin de pausa",
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-ES");
};

const formatTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
};

const formatTimeWithOriginal = (event: TimeEventRow) => {
  const current = formatTime(event.event_time);
  const original = event.original_event_time ? formatTime(event.original_event_time) : null;
  if (original && original !== current) {
    return `${current} (orig ${original})`;
  }
  return current;
};

const toDatetimeLocal = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const formatDuration = (milliseconds?: number) => {
  if (!milliseconds || milliseconds <= 0) return "—";
  const totalMinutes = Math.round(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

const zoneLabel = (event: TimeEventRow) => {
  if (event.is_within_geofence === true) return "Sí (en zona)";
  if (event.is_within_geofence === false) return "No (fuera de zona)";
  return "N/D";
};

const computeWorkedByEvent = (events: TimeEventRow[]) => {
  const byDay = new Map<string, TimeEventRow[]>();
  events.forEach((event) => {
    const day = event.event_time.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(event);
  });

  const durations: Record<string, number> = {};

  byDay.forEach((list) => {
    const sorted = [...list].sort(
      (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
    );

    let lastClockIn: Date | null = null;
    let pauseStart: Date | null = null;
    let pauseMs = 0;

    sorted.forEach((event) => {
      const current = new Date(event.event_time);
      switch (event.event_type) {
        case "clock_in":
          lastClockIn = current;
          pauseStart = null;
          pauseMs = 0;
          break;
        case "pause_start":
          if (!pauseStart) {
            pauseStart = current;
          }
          break;
        case "pause_end":
          if (pauseStart) {
            pauseMs += Math.max(0, current.getTime() - pauseStart.getTime());
            pauseStart = null;
          }
          break;
        case "clock_out":
          if (lastClockIn) {
            let total = current.getTime() - lastClockIn.getTime() - pauseMs;
            if (pauseStart) {
              total -= Math.max(0, current.getTime() - pauseStart.getTime());
            }
            if (total > 0) {
              durations[event.id] = total;
            }
          }
          pauseStart = null;
          pauseMs = 0;
          lastClockIn = null;
          break;
        default:
          break;
      }
    });
  });

  return durations;
};

const OwnerIndividualReports = ({ companyId }: OwnerIndividualReportsProps) => {
  const [workerQuery, setWorkerQuery] = useState("");
  const [workerOptions, setWorkerOptions] = useState<WorkerOption[]>([]);
  const [workerSearchOpen, setWorkerSearchOpen] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerOption | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [events, setEvents] = useState<TimeEventRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [incidentsOnly, setIncidentsOnly] = useState(false);
  const [pendingReviewOnly, setPendingReviewOnly] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<"all" | EventType>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "device" | "kiosk" | "api">("all");
  const [notesOnly, setNotesOnly] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [incidentDates, setIncidentDates] = useState<Set<string>>(new Set());
  const [pendingReviewDates, setPendingReviewDates] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimeEventRow | null>(null);
  const [formType, setFormType] = useState<EventType>("clock_in");
  const [formDate, setFormDate] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingEvent, setDeletingEvent] = useState<TimeEventRow | null>(null);
  const { user } = useAuth();

  const clearFilters = () => {
    setIncidentsOnly(false);
    setPendingReviewOnly(false);
    setNotesOnly(false);
    setEventTypeFilter("all");
    setSourceFilter("all");
  };

  const filtersSummary = useMemo(() => {
    const parts: string[] = [];
    if (pendingReviewOnly) parts.push("Solo pendientes de revisar");
    if (incidentsOnly) parts.push("Solo con incidencias");
    if (notesOnly) parts.push("Solo con notas");
    if (eventTypeFilter !== "all") parts.push(`Tipo: ${EVENT_LABELS[eventTypeFilter]}`);
    if (sourceFilter !== "all") {
      const srcLabel: Record<typeof sourceFilter, string> = {
        all: "Todos",
        manual: "Manual",
        device: "Dispositivo",
        kiosk: "Kiosko",
        api: "API",
      };
      parts.push(`Origen: ${srcLabel[sourceFilter]}`);
    }
    return parts.length ? parts.join(" · ") : "Sin filtros adicionales";
  }, [pendingReviewOnly, incidentsOnly, notesOnly, eventTypeFilter, sourceFilter]);

  const workedByEvent = useMemo(() => computeWorkedByEvent(events), [events]);
  const groupedSessions = useMemo(() => {
    const byDate = new Map<string, TimeEventRow[]>();
    events.forEach((ev) => {
      const key = ev.event_time.slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(ev);
    });

    const buildSessions = (list: TimeEventRow[]) => {
      const sorted = [...list].sort(
        (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
      );
      const sessions: { events: TimeEventRow[]; workedMs: number }[] = [];
      let current: TimeEventRow[] = [];

      const pushCurrent = () => {
        if (current.length === 0) return;
        const workedMs = current.reduce((sum, ev) => sum + (workedByEvent[ev.id] || 0), 0);
        sessions.push({ events: current, workedMs });
        current = [];
      };

      sorted.forEach((ev) => {
        if (ev.event_type === "clock_in" && current.length > 0) {
          pushCurrent();
        }
        current.push(ev);
        if (ev.event_type === "clock_out") {
          pushCurrent();
        }
      });
      pushCurrent();
      return sessions;
    };

    return Array.from(byDate.entries()).map(([dateKey, list]) => ({
      dateKey,
      sessions: buildSessions(list),
    }));
  }, [events, workedByEvent]);

  const loadWorkers = useCallback(async () => {
    if (!companyId) return;
    setWorkerLoading(true);
    const term = workerQuery.trim();
    try {
      // Build allowed IDs based on extra filters
      let allowedIds: string[] | null = null;

      const idSets: string[][] = [];

      if (incidentsOnly) {
        const { data, error } = await supabase
          .from("incidents")
          .select("user_id")
          .eq("company_id", companyId)
          .gte("incident_date", startDate)
          .lte("incident_date", endDate);
        if (error) throw error;
        idSets.push(Array.from(new Set((data || []).map((row) => row.user_id))));
      }

      if (pendingReviewOnly) {
        const { data, error } = await supabase
          .from("work_sessions")
          .select("user_id")
          .eq("company_id", companyId)
          .in("review_status", ["pending_review", "exceeded_limit"])
          .gte("clock_in_time", `${startDate}T00:00:00`)
          .lte("clock_in_time", `${endDate}T23:59:59`);
        if (error) throw error;
        idSets.push(Array.from(new Set((data || []).map((row) => row.user_id))));
      }

      if (idSets.length > 0) {
        // Intersection of all active filters
        allowedIds = idSets.reduce<string[] | null>((acc, list) => {
          if (acc === null) return list;
          const set = new Set(list);
          return acc.filter((id) => set.has(id));
        }, null);

        if (allowedIds && allowedIds.length === 0) {
          setWorkerOptions([]);
          setWorkerLoading(false);
          return;
        }
      }

      let query = supabase
        .from("profiles")
        .select("id, full_name, email, memberships!inner(company_id)")
        .eq("memberships.company_id", companyId)
        .order("full_name", { ascending: true })
        .limit(20);

      if (term) {
        query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
      }

      if (allowedIds) {
        query = query.in("id", allowedIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkerOptions((data as WorkerOption[]) || []);
    } catch (error) {
      console.error("Error buscando trabajadores", error);
      toast.error("No pudimos buscar trabajadores de tu empresa");
      setWorkerOptions([]);
    } finally {
      setWorkerLoading(false);
    }
  }, [
    companyId,
    workerQuery,
    incidentsOnly,
    pendingReviewOnly,
    startDate,
    endDate,
    eventTypeFilter,
    sourceFilter,
    notesOnly,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWorkers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadWorkers]);

  const fetchEvents = useCallback(async () => {
    if (!companyId || !selectedWorker?.id) return;
    setLoadingEvents(true);
    try {
      let eventsQuery = supabase
        .from("time_events")
        .select("id, event_time, original_event_time, event_type, notes, source, created_at, company_id, user_id, is_within_geofence")
        .eq("company_id", companyId)
        .eq("user_id", selectedWorker.id)
        .gte("event_time", `${startDate}T00:00:00`)
        .lte("event_time", `${endDate}T23:59:59`)
        .order("event_time", { ascending: false });

      if (eventTypeFilter !== "all") {
        eventsQuery = eventsQuery.eq("event_type", eventTypeFilter);
      }
      if (sourceFilter !== "all") {
        eventsQuery = eventsQuery.eq("source", sourceFilter);
      }
      if (notesOnly) {
        eventsQuery = eventsQuery.not("notes", "is", null);
      }

      const { data, error } = await eventsQuery;
      if (error) throw error;
      let rows = (data as TimeEventRow[]) || [];

      // Preparamos conjuntos de fechas para filtrar por incidencias o pendientes de revisión
      const activeDateSets: Set<string>[] = [];

      if (incidentsOnly) {
        const { data: incidentRows, error: incidentsError } = await supabase
          .from("incidents")
          .select("incident_date")
          .eq("company_id", companyId)
          .eq("user_id", selectedWorker.id)
          .gte("incident_date", startDate)
          .lte("incident_date", endDate);
        if (incidentsError) throw incidentsError;
        const dates = new Set((incidentRows || []).map((row) => row.incident_date));
        setIncidentDates(dates);
        activeDateSets.push(dates);
      } else {
        setIncidentDates(new Set());
      }

      if (pendingReviewOnly) {
        const { data: pendingSessions, error: pendingError } = await supabase
          .from("work_sessions")
          .select("clock_in_time, clock_out_time")
          .eq("company_id", companyId)
          .eq("user_id", selectedWorker.id)
          .or("review_status.eq.pending_review,review_status.eq.exceeded_limit,status.eq.auto_closed")
          .gte("clock_in_time", `${startDate}T00:00:00`)
          .lte("clock_in_time", `${endDate}T23:59:59`);
        if (pendingError) throw pendingError;
        const pendingDates = new Set<string>();
        (pendingSessions || []).forEach((s) => {
          if (s.clock_in_time) pendingDates.add(String(s.clock_in_time).slice(0, 10));
          if (s.clock_out_time) pendingDates.add(String(s.clock_out_time).slice(0, 10));
        });
        setPendingReviewDates(pendingDates);
        activeDateSets.push(pendingDates);
      }
      if (!pendingReviewOnly) {
        setPendingReviewDates(new Set());
      }

      if (activeDateSets.length > 0) {
        const intersection = activeDateSets.reduce<Set<string> | null>((acc, set) => {
          if (!acc) return new Set(set);
          const next = new Set<string>();
          set.forEach((d) => {
            if (acc.has(d)) next.add(d);
          });
          return next;
        }, null);
        if (intersection && intersection.size > 0) {
          rows = rows.filter((ev) => intersection.has(ev.event_time.slice(0, 10)));
        } else {
          rows = [];
        }
      }

      setEvents(rows);
    } catch (error) {
      console.error("Error cargando fichajes", error);
      toast.error("No pudimos cargar los fichajes del trabajador");
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [
    companyId,
    endDate,
    selectedWorker?.id,
    startDate,
    eventTypeFilter,
    sourceFilter,
    notesOnly,
    incidentsOnly,
    pendingReviewOnly,
  ]);

  useEffect(() => {
    if (selectedWorker?.id) {
      fetchEvents();
    } else {
      setEvents([]);
    }
  }, [fetchEvents, selectedWorker?.id]);

  const resetForm = () => {
    setEditingEvent(null);
    setFormType("clock_in");
    setFormDate(new Date().toISOString().slice(0, 16));
    setFormReason("");
    setFormNotes("");
  };

  const openEditDialog = (event: TimeEventRow) => {
    setEditingEvent(event);
    setFormType(event.event_type);
    setFormDate(toDatetimeLocal(event.event_time));
    setFormNotes(event.notes ?? "");
    setFormOpen(true);
  };

  const saveEvent = async () => {
    if (!selectedWorker?.id) {
      toast.error("Selecciona un trabajador antes de guardar");
      return;
    }
    if (!formDate) {
      toast.error("Indica fecha y hora del registro");
      return;
    }

    const payload = {
      event_time: new Date(formDate).toISOString(),
      event_type: formType,
      notes: formReason || formNotes || null,
      source: "manual",
    };

    if (editingEvent && !formReason.trim()) {
      toast.error("Indica el motivo de la edición (requerido)");
      return;
    }

    setRowPending("save");
    try {
      if (editingEvent) {
        const { data, error } = await supabase
          .from("time_events")
          .update(payload)
          .eq("id", editingEvent.id)
          .eq("company_id", companyId)
          .eq("user_id", selectedWorker.id)
          .select("id, event_time, original_event_time, event_type, notes, is_within_geofence")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("No se actualizó ningún registro");
        // Optimistic update en UI con la fila devuelta por el backend
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === editingEvent.id
              ? { ...ev, event_time: data.event_time, event_type: data.event_type, notes: data.notes }
              : ev
          )
        );
        await supabase.from("audit_logs").insert({
          company_id: companyId,
          actor_user_id: user?.id ?? null,
          action: "update_time_event",
          entity_id: editingEvent.id,
          entity_type: "time_event",
          reason: formReason,
          diff: {
            before: {
              event_time: editingEvent.event_time,
              event_type: editingEvent.event_type,
              notes: editingEvent.notes,
            },
            after: {
              event_time: payload.event_time,
              event_type: payload.event_type,
              notes: payload.notes,
            },
          },
        });
        toast.success("Registro actualizado");
      } else {
        const { error } = await supabase.from("time_events").insert({
          ...payload,
          company_id: companyId,
          user_id: selectedWorker.id,
        });
        if (error) throw error;
        toast.success("Registro creado");
      }
      setFormOpen(false);
      resetForm();
      // Si estábamos filtrando por pendientes, quitamos el filtro para que el registro salga de esa lista
      if (pendingReviewOnly) {
        setPendingReviewOnly(false);
      }
      fetchEvents();
    } catch (error) {
      console.error("Error guardando fichaje", error);
      toast.error("No pudimos guardar el registro");
    } finally {
      setRowPending(null);
    }
  };

  const confirmDelete = (event: TimeEventRow) => {
    setDeletingEvent(event);
    setDeleteReason("");
    setDeleteDialogOpen(true);
  };

  const deleteEvent = async () => {
    if (!selectedWorker?.id || !deletingEvent || !deletingEvent.id) return;
    if (!deleteReason.trim()) {
      toast.error("Indica un motivo para eliminar");
      return;
    }
    setRowPending(deletingEvent.id);
    try {
      // Usa RPC para eliminar y auditar con motivo en servidor
      const { error } = await supabase.rpc("delete_time_event_with_reason", {
        p_event_id: deletingEvent.id,
        p_reason: deleteReason,
      });
      if (error) throw error;

      toast.success("Registro eliminado");
      setDeleteDialogOpen(false);
      setDeletingEvent(null);
      setEvents((prev) =>
        prev.filter(
          (ev) =>
            ev.id !== deletingEvent.id &&
            !(ev.event_time === deletingEvent.event_time && ev.event_type === deletingEvent.event_type)
        )
      );
      fetchEvents();
    } catch (error) {
      console.error("Error eliminando fichaje", error);
      toast.error("No pudimos eliminar el registro");
    } finally {
      setRowPending(null);
    }
  };

  const workerLabel = selectedWorker
    ? `${selectedWorker.full_name || selectedWorker.email} (${selectedWorker.email || "sin email"})`
    : "Selecciona un trabajador";

  const buildReportHtml = () => {
    if (!selectedWorker) return "";
    const rows = groupedSessions
      .flatMap((group) =>
        group.sessions.map((session) => {
          const sequence = session.events
            .map((ev) => `${EVENT_LABELS[ev.event_type]} ${formatTimeWithOriginal(ev)}`)
            .join(" · ");
          const zoneSummary = session.events
            .map((ev) => `${EVENT_LABELS[ev.event_type]} ${formatTime(ev.event_time)}: ${zoneLabel(ev)}`)
            .join(" · ");
          return `
          <tr>
            <td>${formatDate(group.dateKey)}</td>
            <td>${sequence || "-"}</td>
            <td>${session.workedMs > 0 ? formatDuration(session.workedMs) : "—"}</td>
            <td>${session.events[0]?.source || "-"}</td>
            <td>${zoneSummary || "N/D"}</td>
            <td>${session.events.map((ev) => ev.notes || "").filter(Boolean).join(" · ")}</td>
          </tr>`;
        })
      )
      .join("");
    return `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Reporte individual</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 12px; }
            p { margin: 4px 0; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 13px; }
            th { background: #f8fafc; text-align: left; }
            .meta { margin-top: 12px; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Reporte de fichajes</h1>
          <p class="meta"><strong>Trabajador:</strong> ${selectedWorker.full_name || selectedWorker.email || ""}</p>
          <p class="meta"><strong>Email:</strong> ${selectedWorker.email || "—"}</p>
          <p class="meta"><strong>Rango:</strong> ${startDate} a ${endDate}</p>
          <p class="meta"><strong>Filtros:</strong> ${filtersSummary}</p>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Secuencia (Entrada · Pausas · Salida)</th>
                <th>Total</th>
                <th>Origen</th>
                <th>En zona</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="6">Sin registros en el rango seleccionado.</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handlePreviewPdf = () => {
    if (!selectedWorker) {
      toast.error("Selecciona un trabajador para exportar");
      return;
    }
    setPreviewHtml(buildReportHtml());
    setPreviewOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (!selectedWorker) {
      toast.error("Selecciona un trabajador para exportar");
      return;
    }
    const html = buildReportHtml();
    if (!html) return;
    try {
      await html2pdf()
        .set({
          margin: 10,
          filename: `reporte_${selectedWorker.full_name || selectedWorker.email || "trabajador"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(html)
        .save();
      toast.success("PDF generado");
      setPreviewOpen(false);
    } catch (error) {
      console.error("Error generando PDF", error);
      toast.error("No pudimos generar el PDF");
    }
  };

  const handleDownloadCsv = () => {
    if (!selectedWorker) {
      toast.error("Selecciona un trabajador para exportar");
      return;
    }
    const headers = [
      "Fecha",
      "Secuencia (Entrada · Pausas · Salida)",
      "Total trabajado",
      "Origen",
      "En zona",
      "Notas",
    ];
    const dataRows = groupedSessions.flatMap((group) =>
      group.sessions.map((session) => [
        formatDate(group.dateKey),
        session.events
          .map((ev) => `${EVENT_LABELS[ev.event_type]} ${formatTimeWithOriginal(ev)}`)
          .join(" · "),
        session.workedMs > 0 ? formatDuration(session.workedMs) : "",
        session.events[0]?.source || "",
        session.events
          .map((ev) => `${EVENT_LABELS[ev.event_type]} ${formatTime(ev.event_time)}: ${zoneLabel(ev)}`)
          .join(" · "),
        session.events
          .map((ev) => ev.notes || "")
          .filter(Boolean)
          .join(" · "),
      ])
    );
    const metaRows: string[][] = [
      ["Rango", `${startDate} a ${endDate}`, "", "", "", ""],
      ["Filtros", filtersSummary, "", "", "", ""],
    ];
    const rows = [...metaRows, ...dataRows];
    exportCSV(`reporte_${selectedWorker.full_name || selectedWorker.email || "trabajador"}`, headers, rows);
    toast.success("CSV generado");
  };

  return (
    <Card className="glass-card p-6 border-primary/10 bg-background/80">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Vista individual</p>
            <h2 className="text-xl font-bold">Reportes por trabajador</h2>
            <p className="text-sm text-muted-foreground">
              Filtra por empleado y gestiona fichajes sin mezclar datos de otros trabajadores.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadCsv} disabled={!selectedWorker}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={handlePreviewPdf} disabled={!selectedWorker}>
              <FileText className="w-4 h-4 mr-2" />
              Vista previa PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <Label>Trabajador</Label>
            <Popover
              open={workerSearchOpen}
              onOpenChange={(open) => {
                setWorkerSearchOpen(open);
                if (open) setWorkerQuery(""); // deja buscar otro sin limpiar selección
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  aria-expanded={workerSearchOpen}
                >
                  <span className="truncate text-left">{workerLabel}</span>
                  <Users className="w-4 h-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar por nombre o email..."
                    value={workerQuery}
                    onValueChange={setWorkerQuery}
                  />
                  <CommandList>
                    {workerLoading ? (
                      <CommandEmpty className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Buscando trabajadores...
                      </CommandEmpty>
                    ) : (
                      <CommandEmpty>Escribe para buscar trabajadores</CommandEmpty>
                    )}
                    <CommandGroup heading="Resultados">
                      {workerOptions.map((worker) => (
                        <CommandItem
                          key={worker.id}
                          onSelect={() => {
                            setSelectedWorker(worker);
                            setWorkerSearchOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{worker.full_name || worker.email}</span>
                            <span className="text-xs text-muted-foreground">{worker.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedWorker && (
              <div className="flex flex-wrap gap-2 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    setSelectedWorker(null);
                    setEvents([]);
                  }}
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpiar selección
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 h-7 text-xs text-primary"
                  onClick={() => setWorkerSearchOpen(true)}
                >
                  Buscar otro trabajador
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={incidentsOnly}
                  onCheckedChange={(v) => setIncidentsOnly(v === true)}
                />
                Solo con incidencias
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={pendingReviewOnly}
                  onCheckedChange={(v) => setPendingReviewOnly(v === true)}
                />
                Solo con pendientes de revisar
              </label>
            </div>
          </div>
          <div>
            <Label htmlFor="startDate">Desde</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">Hasta</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tipo de registro</Label>
            <Select value={eventTypeFilter} onValueChange={(val: "all" | EventType) => setEventTypeFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="clock_in">Entrada</SelectItem>
                <SelectItem value="clock_out">Salida</SelectItem>
                <SelectItem value="pause_start">Pausa</SelectItem>
                <SelectItem value="pause_end">Fin de pausa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origen</Label>
            <Select value={sourceFilter} onValueChange={(val: "all" | "manual" | "device" | "kiosk" | "api") => setSourceFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="device">Dispositivo</SelectItem>
                <SelectItem value="kiosk">Kiosko</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox checked={notesOnly} onCheckedChange={(v) => setNotesOnly(v === true)} />
            <span className="text-sm">Solo registros con notas</span>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/40 p-4">
          {!selectedWorker && (
            <div className="text-center text-sm text-muted-foreground py-6 space-y-3">
              <p>Selecciona un trabajador en los filtros para empezar.</p>
              <Button size="sm" onClick={() => setWorkerSearchOpen(true)}>
                Buscar trabajador
              </Button>
            </div>
          )}

          {selectedWorker && (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Secuencia (Entrada · Pausas · Salida)</TableHead>
                    <TableHead>Total trabajado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEvents && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cargando fichajes del trabajador...
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!loadingEvents && groupedSessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                        <div className="space-y-3">
                          <p>No hay registros para este trabajador en el rango seleccionado.</p>
                          <div className="flex justify-center gap-2">
                            <Button size="sm" variant="outline" onClick={clearFilters}>
                              Quitar filtros
                            </Button>
                            <Button size="sm" onClick={() => setWorkerSearchOpen(true)}>
                              Cambiar trabajador
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!loadingEvents &&
                    groupedSessions.map((group) => {
                      const canEdit = pendingReviewDates.size > 0 ? pendingReviewDates.has(group.dateKey) : false;
                      return group.sessions.map((session, idx) => (
                        <TableRow key={`${group.dateKey}-${idx}`}>
                          <TableCell className="align-top w-28">{idx === 0 ? formatDate(group.dateKey) : ""}</TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap gap-2">
                              {session.events.map((event) => (
                                <div
                                  key={event.id}
                                  className="flex items-center gap-2 rounded-full border px-3 py-1 bg-muted/40 text-xs"
                                >
                                  <Badge variant="outline" className="capitalize">
                                    {EVENT_LABELS[event.event_type]}
                                  </Badge>
                                  <span className="font-medium">{formatTimeWithOriginal(event)}</span>
                                  {canEdit && (
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => openEditDialog(event)}
                                        title="Editar fichada"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-destructive"
                                        onClick={() => confirmDelete(event)}
                                        disabled={rowPending === event.id}
                                        title="Eliminar fichada"
                                      >
                                        {rowPending === event.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3 h-3" />
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            {session.workedMs > 0 ? formatDuration(session.workedMs) : "—"}
                          </TableCell>
                        </TableRow>
                      ));
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar fichaje</DialogTitle>
            <DialogDescription>
              El registro se guarda únicamente para {selectedWorker?.full_name || "el trabajador seleccionado"} y para la empresa activa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de registro (obligatorio)</Label>
              <Select value={formType} onValueChange={(val: EventType) => setFormType(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="clock_in">Entrada</SelectItem>
                    <SelectItem value="clock_out">Salida</SelectItem>
                    <SelectItem value="pause_start">Pausa</SelectItem>
                    <SelectItem value="pause_end">Fin de pausa</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha y hora (obligatorio)</Label>
              <Input
                type="datetime-local"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex justify-between items-center">
              <span>Motivo</span>
              <span className="text-xs text-muted-foreground">{editingEvent ? "Obligatorio" : "Opcional"}</span>
            </Label>
            <Input
              placeholder={editingEvent ? "Indica el motivo de la edición (requerido)" : "Motivo o notas (opcional)"}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              required={!!editingEvent}
              />
              {!editingEvent && (
                <Input
                  placeholder="Notas adicionales (opcional)"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={saveEvent}
              disabled={
                rowPending === "save" || !selectedWorker || !formDate || (editingEvent ? !formReason.trim() : false)
              }
            >
              {rowPending === "save" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista previa PDF</DialogTitle>
            <DialogDescription>
              Reporte individual para {selectedWorker?.full_name || selectedWorker?.email || "trabajador"}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto border rounded-md p-4 bg-muted/30">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={handleDownloadPdf}>
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              Esta acción elimina el fichaje de forma permanente. Debes indicar un motivo para dejar constancia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registro: {deletingEvent ? formatDate(deletingEvent.event_time) : "--"} ·{" "}
              {deletingEvent ? formatTime(deletingEvent.event_time) : "--"} ·{" "}
              {deletingEvent ? EVENT_LABELS[deletingEvent.event_type] : ""}
            </p>
            <div className="space-y-2">
              <Label>Motivo (obligatorio)</Label>
              <Input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Indica el motivo de la eliminación"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={deleteEvent}
              disabled={rowPending === deletingEvent?.id || !deleteReason.trim()}
            >
              {rowPending === deletingEvent?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Eliminar fichaje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default OwnerIndividualReports;
