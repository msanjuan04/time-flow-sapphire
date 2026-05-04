import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildTemplateSummary,
  calcWeeklyHours,
  type ScheduleTemplate,
} from "@/lib/scheduleTemplates";
import ApplyTemplateDialog from "@/components/owner/ApplyTemplateDialog";
import { Link } from "react-router-dom";

interface Props {
  companyId: string;
  /** User IDs to apply to. If only one, it's an employee detail context;
   *  if many, it's a "apply to team" context. */
  initialUserIds: string[];
  /** Label of the button. Defaults to "Aplicar plantilla". */
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

/**
 * Button that opens a "pick template" picker, then drills into ApplyTemplateDialog
 * with the selected template + the pre-selected user IDs. Centralizes the entry
 * point so users don't have to navigate to /owner/schedule-templates manually.
 */
export function ApplyTemplateButton({
  companyId,
  initialUserIds,
  label = "Aplicar plantilla",
  size = "default",
  variant = "default",
  className,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ScheduleTemplate | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTemplates((data as ScheduleTemplate[]) || []);
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar plantillas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pickerOpen) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  const choose = (t: ScheduleTemplate) => {
    setSelected(t);
    setPickerOpen(false);
    setApplyOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={`gap-2 ${className || ""}`}
        onClick={() => setPickerOpen(true)}
        disabled={initialUserIds.length === 0}
      >
        <Sparkles className="w-4 h-4" />
        {label}
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Elige una plantilla</DialogTitle>
            <DialogDescription>
              Se aplicará a {initialUserIds.length} {initialUserIds.length === 1 ? "trabajador" : "trabajadores"}.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay plantillas creadas en esta empresa.
              </p>
              <Button asChild variant="default">
                <Link to="/owner/schedule-templates" onClick={() => setPickerOpen(false)}>
                  Crear primera plantilla
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => {
                const hours = calcWeeklyHours(t);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => choose(t)}
                    className="w-full text-left border rounded-md p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm">{t.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {hours.toFixed(1)}h/semana
                      </Badge>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mb-1">{t.description}</p>
                    )}
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {buildTemplateSummary(t)}
                    </p>
                  </button>
                );
              })}
              <div className="pt-2 text-center">
                <Link
                  to="/owner/schedule-templates"
                  onClick={() => setPickerOpen(false)}
                  className="text-xs text-primary hover:underline"
                >
                  Crear o gestionar plantillas →
                </Link>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <ApplyTemplateDialog
          open={applyOpen}
          onOpenChange={(o) => {
            setApplyOpen(o);
            if (!o) setSelected(null);
          }}
          template={selected}
          companyId={companyId}
          initialUserIds={initialUserIds}
        />
      )}
    </>
  );
}

export default ApplyTemplateButton;
