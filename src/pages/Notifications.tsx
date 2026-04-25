import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  company_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
  entity_type?: string | null;
  entity_id?: string | null;
}

type ReadFilter = "all" | "unread" | "read";
type TypeFilter = "all" | Notification["type"];

const PAGE_SIZE = 25;

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const fetchPage = async (targetPage: number) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("notifications")
        .select("id, company_id, title, message, type, read, created_at, entity_type, entity_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE);

      if (readFilter === "unread") query = query.eq("read", false);
      if (readFilter === "read") query = query.eq("read", true);
      if (typeFilter !== "all") query = query.eq("type", typeFilter);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Notification[];
      setHasMore(rows.length > PAGE_SIZE);
      setNotifications(rows.slice(0, PAGE_SIZE));
      setPage(targetPage);
    } catch (err) {
      console.error("Error loading notifications:", err);
      toast.error("Error al cargar notificaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, readFilter, typeFilter]);

  const markOne = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo marcar como leída");
      return;
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAll = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    if (error) {
      toast.error("No se pudo marcar todo como leído");
      return;
    }
    toast.success("Todas marcadas como leídas");
    void fetchPage(page);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markOne(n.id);
    if (n.entity_type === "incident" && n.entity_id) {
      navigate(`/incidents?focus=${n.entity_id}`);
    } else if (n.entity_type === "anomaly" && n.entity_id) {
      navigate(`/people?user=${n.entity_id}`);
    } else if (
      (n.entity_type === "correction_request" || n.entity_type === "absence_request") &&
      n.entity_id
    ) {
      navigate(`/correction-requests?focus=${n.entity_id}`);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto pt-4 sm:pt-8 space-y-4 sm:space-y-6">
        <PageHeader
          icon={Bell}
          title="Notificaciones"
          description="Historial completo de avisos y solicitudes"
          actions={
            unreadCount > 0 ? (
              <Button variant="outline" size="sm" onClick={markAll}>
                Marcar todas como leídas
              </Button>
            ) : null
          }
        />

        <Card className="p-3 flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estado:</span>
            <Select value={readFilter} onValueChange={(v) => setReadFilter(v as ReadFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">No leídas</SelectItem>
                <SelectItem value="read">Leídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tipo:</span>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Éxito</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {loading && notifications.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Cargando...</Card>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Sin notificaciones"
            description="No hay notificaciones que coincidan con los filtros seleccionados."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={cn(
                    "p-4 cursor-pointer hover-scale smooth-transition",
                    !n.read && "border-primary/40 bg-primary/5"
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{n.title}</h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(n.created_at).toLocaleString("es-ES")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      {n.entity_type && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-[11px]">
                            {n.entity_type === "correction_request"
                              ? "Solicitud de corrección"
                              : n.entity_type === "absence_request"
                                ? "Solicitud de ausencia"
                                : n.entity_type === "incident"
                                  ? "Incidencia"
                                  : n.entity_type === "anomaly"
                                    ? "Anomalía"
                                    : n.entity_type}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-2" />}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => fetchPage(Math.max(0, page - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">Página {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore || loading}
            onClick={() => fetchPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
