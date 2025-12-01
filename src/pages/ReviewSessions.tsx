import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Clock, AlertCircle } from "lucide-react";
import ReviewSessionDialog from "@/components/ReviewSessionDialog";
import { BackButton } from "@/components/BackButton";
import OwnerQuickNav from "@/components/OwnerQuickNav";

export type WorkSessionReview = {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  review_status: string | null;
  status: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

const ReviewSessionsPage = () => {
  const { user } = useAuth();
  const { companyId, role } = useMembership();
  const [sessions, setSessions] = useState<WorkSessionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkSessionReview | null>(null);

  const canReview = useMemo(() => ["owner", "admin", "manager"].includes(role ?? ""), [role]);

  const fetchSessions = async () => {
    if (!companyId || !canReview) return;
    setLoading(true);
    const baseSelect =
      "id, user_id, clock_in_time, clock_out_time, review_status, status, is_corrected";

    const { data, error } = await supabase
      .from("work_sessions")
      .select(baseSelect)
      .eq("company_id", companyId)
      .or("review_status.eq.exceeded_limit,review_status.eq.pending_review,review_status.is.null,status.eq.auto_closed")
      .order("clock_in_time", { ascending: true });

    if (error) {
      console.error("Error loading sessions to review", error);
      setLoading(false);
      return;
    }

    let rows = (data as WorkSessionReview[]) ?? [];
    if (!rows.length) {
      const { data: all } = await supabase
        .from("work_sessions")
        .select(baseSelect)
        .eq("company_id", companyId)
        .order("clock_in_time", { ascending: true });
      const pending =
        (all as WorkSessionReview[])?.filter((row) => {
          const pendingStatuses = ["exceeded_limit", "pending_review"];
          return (
            pendingStatuses.includes(row.review_status ?? "") ||
            row.status === "auto_closed" ||
            (!row.review_status && row.status !== "closed")
          );
        }) ?? [];
      rows = pending;
    }

    // Traemos nombres de perfiles para mostrar el nombre real
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const map = new Map<string, { full_name: string | null; email: string | null }>();
      (profiles || []).forEach((p: any) => {
        map.set(p.id, { full_name: p.full_name, email: p.email });
      });
      rows = rows.map((r) => ({
        ...r,
        profiles: map.get(r.user_id) || null,
      }));
    }

    setSessions(rows);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [companyId, canReview]);

  if (!canReview) {
    return (
      <div className="p-6">
        <Card className="p-4 flex items-center gap-2 text-amber-600">
          <AlertCircle className="w-5 h-5" />
          <span>No tienes permisos para revisar fichajes.</span>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Fichajes a revisar</h1>
            <p className="text-sm text-muted-foreground">Sesiones que superaron el límite y requieren ajuste.</p>
          </div>
        </div>
        <div className="flex-1 flex justify-end">
          <OwnerQuickNav />
        </div>
      </div>

      <Card className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando fichajes…
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-muted-foreground">No tienes fichajes pendientes de revisión.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida (auto)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => {
                const start = new Date(s.clock_in_time);
                const end = s.clock_out_time ? new Date(s.clock_out_time) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.profiles?.full_name || s.profiles?.email || s.user_id}</div>
                      <div className="text-xs text-muted-foreground">{s.profiles?.email}</div>
                    </TableCell>
                    <TableCell>{start.toLocaleDateString("es-ES")}</TableCell>
                    <TableCell>{start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>{end ? end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">Pendiente revisión</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setSelected(s)}>
                        Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ReviewSessionDialog
        session={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          fetchSessions();
        }}
      />
    </div>
  );
};

export default ReviewSessionsPage;
