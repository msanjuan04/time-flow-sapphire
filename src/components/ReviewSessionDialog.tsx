import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { WorkSessionReview } from "@/pages/ReviewSessions";

type Props = {
  session: WorkSessionReview | null;
  onClose: () => void;
  onSaved: () => void;
};

const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export const ReviewSessionDialog = ({ session, onClose, onSaved }: Props) => {
  const { user } = useAuth();
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.clock_in_time);
    const end = session.clock_out_time ? new Date(session.clock_out_time) : new Date();
    setClockIn(toLocalInput(start));
    setClockOut(toLocalInput(end));
    setReason(session.review_status === "exceeded_limit" ? "Superó límite de horas" : "");
  }, [session]);

  const durationHours = useMemo(() => {
    if (!clockIn || !clockOut) return 0;
    const start = new Date(clockIn).getTime();
    const end = new Date(clockOut).getTime();
    return end > start ? (end - start) / (1000 * 60 * 60) : 0;
  }, [clockIn, clockOut]);

  const handleSave = async () => {
    if (!session || !user) return;
    if (!clockIn || !clockOut) {
      toast.error("Indica entrada y salida");
      return;
    }
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    if (end <= start) {
      toast.error("La salida debe ser posterior a la entrada");
      return;
    }
    setSaving(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("work_sessions")
      .update({
        clock_in_time: start.toISOString(),
        clock_out_time: end.toISOString(),
        status: "closed",
        review_status: "resolved",
        is_corrected: true,
        corrected_by: user.id,
        corrected_at: nowIso,
        correction_reason: reason || null,
      })
      .eq("id", session.id);

    if (error) {
      console.error("Error updating session", error);
      toast.error("No se pudo guardar la corrección");
    } else {
      toast.success("Fichada corregida");
      onSaved();
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Revisar fichada</DialogTitle>
        </DialogHeader>
        {session && (
          <div className="space-y-4">
            <div>
              <p className="font-medium">{session.profiles?.full_name || session.profiles?.email || session.user_id}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(session.clock_in_time).toLocaleDateString("es-ES")}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrada</Label>
                <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Salida</Label>
                <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Horas calculadas: {durationHours.toFixed(2)} h</div>
            <div className="space-y-2">
              <Label>Motivo / comentario</Label>
              <Textarea
                placeholder="Ej. Olvidó fichar salida"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewSessionDialog;
