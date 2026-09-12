import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileSignature, Loader2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchMonthState,
  formatHoras,
  isFutureMonth,
  lastClosedMonth,
  monthLabel,
  shiftMonth,
  signMonth,
  type MonthState,
} from "@/lib/monthlyClose";

/**
 * Mi mes: horas trabajadas frente a las previstas, horas extra y firma.
 *
 * El artículo 35.5 del Estatuto obliga a totalizar las horas extra de cada
 * periodo de abono y entregar copia al trabajador. Esta es esa copia, y
 * además recoge su conformidad.
 */

interface Props {
  companyId: string;
}

const MonthlySignoffCard = ({ companyId }: Props) => {
  const [period, setPeriod] = useState(() => lastClosedMonth());
  const [state, setState] = useState<MonthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "signed" | "disputed">(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await fetchMonthState(companyId, period.year, period.month));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el mes");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, period.month, period.year]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    if (!dialog) return;
    setSaving(true);
    try {
      await signMonth(companyId, period.year, period.month, dialog, note.trim() || undefined);
      toast.success(dialog === "signed" ? "Mes firmado" : "Disconformidad registrada");
      setDialog(null);
      setNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo firmar");
    } finally {
      setSaving(false);
    }
  };

  const totals = state?.summary.totals;
  const signoff = state?.signoff;
  const nextPeriod = shiftMonth(period.year, period.month, 1);
  const canGoForward = !isFutureMonth(nextPeriod.year, nextPeriod.month);

  return (
    <Card className="glass-card p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            Mi mes
          </h2>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel(period.year, period.month)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes anterior"
            onClick={() => setPeriod(shiftMonth(period.year, period.month, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes siguiente"
            disabled={!canGoForward}
            onClick={() => setPeriod(nextPeriod)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Calculando el mes…
        </p>
      )}

      {error && !loading && <p className="text-sm text-destructive">{error}</p>}

      {totals && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Trabajadas", value: totals.worked, tone: "" },
              { label: "Previstas", value: totals.expected, tone: "text-muted-foreground" },
              { label: "Horas extra", value: totals.extra, tone: totals.extra > 0 ? "text-amber-600" : "" },
              { label: "Por debajo", value: totals.deficit, tone: totals.deficit > 0 ? "text-muted-foreground" : "" },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className={cn("text-xl font-semibold tabular-nums mt-0.5", tile.tone)}>{formatHoras(tile.value)}</p>
              </div>
            ))}
          </div>

          {totals.withoutSchedule > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatHoras(totals.withoutSchedule)} en días sin horario asignado. No cuentan como extra.
            </p>
          )}

          {state?.outdated && (
            <p className="text-sm text-amber-600 flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              Se ha corregido algún fichaje después de tu firma. Revisa el mes y vuelve a firmarlo.
            </p>
          )}

          {signoff && signoff.status !== "pending" ? (
            <div className="flex items-start gap-2 text-sm">
              {signoff.status === "signed" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              ) : (
                <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-medium">
                  {signoff.status === "signed" ? "Diste tu conformidad" : "Firmado en disconformidad"}
                  {signoff.signed_at
                    ? ` el ${new Date(signoff.signed_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}`
                    : ""}
                </p>
                {signoff.signature?.note && <p className="text-muted-foreground">{signoff.signature.note}</p>}
              </div>
            </div>
          ) : state?.month_is_over ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => setDialog("signed")} className="sm:w-auto">
                Firmar conforme
              </Button>
              <Button variant="outline" onClick={() => setDialog("disputed")} className="sm:w-auto">
                No estoy conforme
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Podrás firmar este mes cuando termine.</p>
          )}

          {state && state.summary.days.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Ver el detalle por día
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Día</th>
                      <th className="py-2 pr-2 font-medium text-right">Trabajado</th>
                      <th className="py-2 pr-2 font-medium text-right">Previsto</th>
                      <th className="py-2 font-medium text-right">Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.summary.days.map((day) => (
                      <tr key={day.date} className="border-t border-border/50">
                        <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">
                          {new Date(`${day.date}T00:00:00`).toLocaleDateString("es-ES", {
                            weekday: "short",
                            day: "2-digit",
                          })}
                          {day.absence && <span className="text-muted-foreground"> · ausencia</span>}
                        </td>
                        <td className="py-1.5 pr-2 tabular-nums text-right">{formatHoras(day.worked)}</td>
                        <td className="py-1.5 pr-2 tabular-nums text-right text-muted-foreground">
                          {formatHoras(day.expected)}
                        </td>
                        <td
                          className={cn(
                            "py-1.5 tabular-nums text-right",
                            day.extra > 0 && "text-amber-600 font-medium"
                          )}
                        >
                          {day.extra > 0 ? formatHoras(day.extra) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "signed" ? "Firmar el mes" : "Firmar en disconformidad"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "signed"
                ? `Confirmas que el registro de ${monthLabel(period.year, period.month)} refleja tu jornada, incluidas las horas extra.`
                : "Explica qué no cuadra. Tu responsable recibirá un aviso con el motivo."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="nota-firma">
              {dialog === "signed" ? "Comentario (opcional)" : "Motivo"}
            </label>
            <Textarea
              id="nota-firma"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                dialog === "signed"
                  ? "Ej. conforme con las horas del mes"
                  : "Ej. faltan dos horas del día 14, salí más tarde"
              }
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dialog === "signed" ? "Firmar conforme" : "Enviar disconformidad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MonthlySignoffCard;
