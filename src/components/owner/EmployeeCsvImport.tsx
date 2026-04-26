import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once after the import finishes so the parent can refresh lists. */
  onImported?: (summary: ImportSummary) => void;
}

type Role = "worker" | "manager" | "owner";

interface CsvRow {
  rowIndex: number; // 1-based original CSV line index (excl. header)
  email: string;
  full_name: string;
  role: Role;
  hire_date: string; // YYYY-MM-DD or ""
  vacation_days_override: string; // numeric or ""
  errors: string[];
}

interface ImportResult {
  email: string;
  ok: boolean;
  message: string;
}

export interface ImportSummary {
  total: number;
  invited: number;
  failed: number;
  results: ImportResult[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: Role[] = ["worker", "manager", "owner"];
const REQUIRED_HEADER = ["email"];
const ALL_KNOWN_HEADERS = [
  "email",
  "full_name",
  "role",
  "hire_date",
  "vacation_days_override",
];

const SAMPLE_CSV = `email,full_name,role,hire_date,vacation_days_override
juan.perez@miempresa.com,Juan Pérez,worker,2024-01-15,
maria.lopez@miempresa.com,María López,manager,2023-09-01,25
carlos.gomez@miempresa.com,Carlos Gómez,worker,2025-03-10,`;

/**
 * Tiny CSV parser that supports:
 *  - Comma separator
 *  - Double-quoted fields with embedded commas / newlines
 *  - Escaped quotes ("")
 * Returns an array of rows where each row is an array of cell strings.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // flush last
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0].trim() === ""));
}

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseAndValidate(text: string): { rows: CsvRow[]; headerError: string | null } {
  const grid = parseCsv(text.trim());
  if (grid.length === 0) {
    return { rows: [], headerError: "El archivo está vacío" };
  }
  const headers = grid[0].map(normalizeHeader);
  const missing = REQUIRED_HEADER.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      rows: [],
      headerError: `Faltan columnas obligatorias: ${missing.join(", ")}`,
    };
  }
  const idx = (h: string) => headers.indexOf(h);
  const colEmail = idx("email");
  const colName = idx("full_name");
  const colRole = idx("role");
  const colHire = idx("hire_date");
  const colVac = idx("vacation_days_override");

  const seenEmails = new Set<string>();
  const rows: CsvRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const email = (cells[colEmail] || "").trim().toLowerCase();
    const full_name = colName >= 0 ? (cells[colName] || "").trim() : "";
    const roleRaw = colRole >= 0 ? (cells[colRole] || "").trim().toLowerCase() : "worker";
    const hire_date = colHire >= 0 ? (cells[colHire] || "").trim() : "";
    const vacation_days_override =
      colVac >= 0 ? (cells[colVac] || "").trim() : "";

    const errors: string[] = [];
    if (!email) errors.push("email vacío");
    else if (!EMAIL_REGEX.test(email)) errors.push("email no válido");
    else if (seenEmails.has(email)) errors.push("email duplicado en el CSV");

    let role: Role = "worker";
    if (roleRaw) {
      if (!VALID_ROLES.includes(roleRaw as Role)) {
        errors.push(`role inválido (usa: ${VALID_ROLES.join("/")})`);
      } else {
        role = roleRaw as Role;
      }
    }

    if (hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(hire_date)) {
      errors.push("hire_date debe ser YYYY-MM-DD");
    }

    if (vacation_days_override && isNaN(Number(vacation_days_override))) {
      errors.push("vacation_days_override no es número");
    }

    if (email && EMAIL_REGEX.test(email)) seenEmails.add(email);

    rows.push({
      rowIndex: r,
      email,
      full_name,
      role,
      hire_date,
      vacation_days_override,
      errors,
    });
  }
  return { rows, headerError: null };
}

export function EmployeeCsvImport({ open, onOpenChange, onImported }: Props) {
  const [csvText, setCsvText] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const parsed = useMemo(() => (csvText ? parseAndValidate(csvText) : null), [csvText]);
  const validRows = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsed?.rows.filter((r) => r.errors.length > 0) ?? [];

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setSummary(null);
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    setImporting(true);
    setProgress({ done: 0, total: validRows.length });
    const results: ImportResult[] = [];

    for (const row of validRows) {
      try {
        // 1) Send invite via existing edge function
        const { error: inviteErr } = await supabase.functions.invoke("create-invite", {
          body: {
            email: row.email,
            role: row.role,
          },
        });

        if (inviteErr) {
          const msg = (inviteErr as any)?.message || String(inviteErr);
          results.push({ email: row.email, ok: false, message: `invite: ${msg}` });
          continue;
        }

        // 2) Try to apply optional profile fields (full_name, hire_date,
        //    vacation_days_override). The invite helper has just upserted the
        //    profile by email so this should usually succeed.
        const updates: Record<string, any> = {};
        if (row.full_name) updates.full_name = row.full_name;
        if (row.hire_date) updates.hire_date = row.hire_date;
        if (row.vacation_days_override) {
          updates.vacation_days_override = Number(row.vacation_days_override);
        }
        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabase
            .from("profiles")
            .update(updates as any)
            .eq("email", row.email);
          if (updErr) {
            results.push({
              email: row.email,
              ok: true,
              message: `Invitado (perfil sin actualizar: ${updErr.message})`,
            });
            continue;
          }
        }

        results.push({ email: row.email, ok: true, message: "Invitado" });
      } catch (err: any) {
        results.push({
          email: row.email,
          ok: false,
          message: err?.message || "Error desconocido",
        });
      } finally {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }

    const finalSummary: ImportSummary = {
      total: validRows.length,
      invited: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
    setSummary(finalSummary);
    setImporting(false);
    setProgress(null);
    onImported?.(finalSummary);

    if (finalSummary.failed === 0) {
      toast.success(`${finalSummary.invited} empleados invitados correctamente`);
    } else {
      toast.warning(
        `${finalSummary.invited} invitados, ${finalSummary.failed} con errores`
      );
    }
  };

  const handleReset = () => {
    setCsvText("");
    setSummary(null);
    setProgress(null);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-empleados.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!importing) onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Importar empleados desde CSV
          </DialogTitle>
          <DialogDescription>
            Sube un CSV o pégalo abajo. Se enviará una invitación a cada email
            válido. Columnas opcionales: full_name, role, hire_date,
            vacation_days_override.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: input */}
        {!summary && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar plantilla
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-2"
              >
                <label className="cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Subir archivo .csv
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </label>
              </Button>
            </div>

            <div>
              <Label htmlFor="csv-text" className="text-xs">
                O pega el contenido CSV
              </Label>
              <Textarea
                id="csv-text"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={SAMPLE_CSV}
                rows={6}
                className="font-mono text-xs"
              />
            </div>

            {parsed?.headerError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
                <AlertTriangle className="w-4 h-4" />
                {parsed.headerError}
              </div>
            )}

            {parsed && parsed.rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-emerald-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {validRows.length} válidas
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {invalidRows.length} con errores
                    </Badge>
                  )}
                </div>

                <div className="max-h-72 overflow-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-1">#</th>
                        <th className="px-2 py-1">Email</th>
                        <th className="px-2 py-1">Nombre</th>
                        <th className="px-2 py-1">Rol</th>
                        <th className="px-2 py-1">Alta</th>
                        <th className="px-2 py-1">Días vac.</th>
                        <th className="px-2 py-1">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.map((r) => (
                        <tr
                          key={r.rowIndex}
                          className={
                            r.errors.length > 0
                              ? "bg-destructive/5"
                              : "bg-emerald-500/5"
                          }
                        >
                          <td className="px-2 py-1 text-muted-foreground">{r.rowIndex}</td>
                          <td className="px-2 py-1 font-mono">{r.email || "—"}</td>
                          <td className="px-2 py-1">{r.full_name || "—"}</td>
                          <td className="px-2 py-1">{r.role}</td>
                          <td className="px-2 py-1">{r.hire_date || "—"}</td>
                          <td className="px-2 py-1">{r.vacation_days_override || "—"}</td>
                          <td className="px-2 py-1">
                            {r.errors.length === 0 ? (
                              <span className="text-emerald-600">✓ OK</span>
                            ) : (
                              <span className="text-destructive" title={r.errors.join(", ")}>
                                {r.errors.join("; ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress overlay */}
        {progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando invitaciones… {progress.done}/{progress.total}
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step 2: summary */}
        {summary && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-600 text-base px-3 py-1">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {summary.invited} invitados
              </Badge>
              {summary.failed > 0 && (
                <Badge variant="destructive" className="text-base px-3 py-1">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {summary.failed} con errores
                </Badge>
              )}
            </div>
            <div className="max-h-72 overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-left">
                    <th className="px-2 py-1">Email</th>
                    <th className="px-2 py-1">Estado</th>
                    <th className="px-2 py-1">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.results.map((r, i) => (
                    <tr
                      key={i}
                      className={r.ok ? "bg-emerald-500/5" : "bg-destructive/5"}
                    >
                      <td className="px-2 py-1 font-mono">{r.email}</td>
                      <td className="px-2 py-1">
                        {r.ok ? (
                          <span className="text-emerald-600">✓ OK</span>
                        ) : (
                          <span className="text-destructive">✗ Error</span>
                        )}
                      </td>
                      <td className="px-2 py-1">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {summary ? (
            <>
              <Button variant="ghost" onClick={handleReset}>
                Importar otro
              </Button>
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={importing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="gap-2"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Importar {validRows.length} {validRows.length === 1 ? "empleado" : "empleados"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EmployeeCsvImport;
