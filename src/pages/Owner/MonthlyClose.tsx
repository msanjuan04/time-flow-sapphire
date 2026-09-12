import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMembership } from "@/hooks/useMembership";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { exportCSV } from "@/lib/exports";
import { cn } from "@/lib/utils";
import {
  fetchMonthTeam,
  formatHoras,
  isFutureMonth,
  lastClosedMonth,
  monthLabel,
  shiftMonth,
  SIGNOFF_LABELS,
  type MonthTeamRow,
} from "@/lib/monthlyClose";

/**
 * Cierre mensual del equipo: horas trabajadas, previstas y extra de cada
 * persona, y si ha firmado su mes. El resumen lo recalcula el servidor
 * desde los fichajes, no se guarda un total aparte.
 */

const MonthlyClose = () => {
  useDocumentTitle("Cierre mensual • GTiQ");
  const { companyId } = useMembership();
  const [period, setPeriod] = useState(() => lastClosedMonth());
  const [rows, setRows] = useState<MonthTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await fetchMonthTeam(companyId, period.year, period.month);
      setRows(data.rows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el cierre del mes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, period.month, period.year]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          worked: acc.worked + (r.totals?.worked ?? 0),
          expected: acc.expected + (r.totals?.expected ?? 0),
          extra: acc.extra + (r.totals?.extra ?? 0),
          firmados: acc.firmados + (r.signoff?.status === "signed" ? 1 : 0),
          disconformes: acc.disconformes + (r.signoff?.status === "disputed" ? 1 : 0),
        }),
        { worked: 0, expected: 0, extra: 0, firmados: 0, disconformes: 0 }
      ),
    [rows]
  );

  const nextPeriod = shiftMonth(period.year, period.month, 1);
  const canGoForward = !isFutureMonth(nextPeriod.year, nextPeriod.month);

  const descargarCsv = () => {
    exportCSV(
      `cierre_${period.year}_${String(period.month).padStart(2, "0")}`,
      ["Persona", "Email", "Trabajadas", "Previstas", "Extra", "Por debajo", "Firma", "Fecha firma"],
      rows.map((r) => [
        r.full_name ?? "",
        r.email ?? "",
        String(r.totals?.worked ?? 0),
        String(r.totals?.expected ?? 0),
        String(r.totals?.extra ?? 0),
        String(r.totals?.deficit ?? 0),
        SIGNOFF_LABELS[r.signoff?.status ?? "pending"],
        r.signoff?.signed_at ? new Date(r.signoff.signed_at).toLocaleString("es-ES") : "",
      ])
    );
  };

  return (
    <AppLayout>
      <PageHeader title="Cierre mensual" description="Horas del mes, horas extra y firma de cada persona" />

      <div className="space-y-4">
        <Card className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mes anterior"
              onClick={() => setPeriod(shiftMonth(period.year, period.month, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <p className="font-medium capitalize min-w-[170px] text-center">{monthLabel(period.year, period.month)}</p>
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={descargarCsv} disabled={rows.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Horas trabajadas", value: formatHoras(totals.worked) },
            { label: "Horas previstas", value: formatHoras(totals.expected) },
            { label: "Horas extra", value: formatHoras(totals.extra) },
            { label: "Firmas", value: `${totals.firmados} de ${rows.length}` },
          ].map((tile) => (
            <Card key={tile.label} className="glass-card p-4">
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{tile.value}</p>
            </Card>
          ))}
        </div>

        {totals.disconformes > 0 && (
          <p className="text-sm text-amber-600">
            {totals.disconformes} {totals.disconformes === 1 ? "persona ha firmado" : "personas han firmado"} en
            disconformidad. Revisa su detalle antes de cerrar el mes.
          </p>
        )}

        <Card className="glass-card p-0 overflow-hidden">
          {error && <p className="text-sm text-destructive p-4">{error}</p>}
          {loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Recalculando el mes de cada persona…
            </p>
          )}
          {!loading && rows.length === 0 && !error && (
            <p className="text-sm text-muted-foreground p-4">No hay personas en esta empresa.</p>
          )}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground bg-muted/40">
                    <th className="p-3 font-medium">Persona</th>
                    <th className="p-3 font-medium">Trabajadas</th>
                    <th className="p-3 font-medium">Previstas</th>
                    <th className="p-3 font-medium">Extra</th>
                    <th className="p-3 font-medium">Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = row.signoff?.status ?? "pending";
                    return (
                      <tr key={row.user_id} className="border-t border-border/50">
                        <td className="p-3">
                          <p className="font-medium">{row.full_name || row.email}</p>
                          <p className="text-xs text-muted-foreground">{row.role}</p>
                        </td>
                        <td className="p-3 tabular-nums">{formatHoras(row.totals?.worked ?? 0)}</td>
                        <td className="p-3 tabular-nums text-muted-foreground">
                          {formatHoras(row.totals?.expected ?? 0)}
                        </td>
                        <td className={cn("p-3 tabular-nums", (row.totals?.extra ?? 0) > 0 && "text-amber-600 font-medium")}>
                          {(row.totals?.extra ?? 0) > 0 ? formatHoras(row.totals.extra) : "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "text-xs rounded-full border px-2 py-1",
                              status === "signed" && "border-primary/40 text-primary",
                              status === "disputed" && "border-amber-500/50 text-amber-600",
                              status === "pending" && "text-muted-foreground"
                            )}
                          >
                            {SIGNOFF_LABELS[status]}
                          </span>
                          {row.outdated && (
                            <span className="block text-[11px] text-amber-600 mt-1">Corregido tras firmar</span>
                          )}
                          {row.signoff?.signature?.note && (
                            <span className="block text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                              {row.signoff.signature.note}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default MonthlyClose;
