import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  companyId: string;
  userId: string;
  /** True if current user is owner/admin and can upload/delete. */
  canManage: boolean;
}

interface DocRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  document_date: string | null;
  expires_at: string | null;
  notes: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  contract: "Contrato",
  addendum: "Anexo / modificación",
  training: "Formación",
  medical: "Reconocimiento médico",
  prl: "PRL",
  rgpd: "RGPD",
  id_document: "DNI / NIE / Pasaporte",
  other: "Otro",
};

const CATEGORY_COLORS: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700 border-blue-300",
  addendum: "bg-cyan-100 text-cyan-700 border-cyan-300",
  training: "bg-purple-100 text-purple-700 border-purple-300",
  medical: "bg-rose-100 text-rose-700 border-rose-300",
  prl: "bg-amber-100 text-amber-700 border-amber-300",
  rgpd: "bg-slate-100 text-slate-700 border-slate-300",
  id_document: "bg-indigo-100 text-indigo-700 border-indigo-300",
  other: "bg-gray-100 text-gray-700 border-gray-300",
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const fmtSize = (bytes: number | null): string => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function EmployeeDocumentsCard({ companyId, userId, canManage }: Props) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    category: "contract",
    title: "",
    description: "",
    document_date: "",
    expires_at: "",
    file: null as File | null,
  });

  const load = useCallback(async () => {
    if (!companyId || !userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      setDocs((data as DocRow[]) || []);
    } catch (err: any) {
      console.error("EmployeeDocs load error:", err);
      toast.error("No se pudieron cargar los documentos");
    } finally {
      setLoading(false);
    }
  }, [companyId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setForm({
      category: "contract",
      title: "",
      description: "",
      document_date: "",
      expires_at: "",
      file: null,
    });
  };

  const handleUpload = async () => {
    if (!form.file) {
      toast.error("Selecciona un archivo");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Pon un título descriptivo");
      return;
    }
    setUploading(true);
    try {
      // Path: {companyId}/{userId}/{timestamp}-{filename}
      const safeName = form.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${companyId}/${userId}/${Date.now()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("employee-documents")
        .upload(path, form.file, {
          contentType: form.file.type,
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("employee_documents").insert({
        company_id: companyId,
        user_id: userId,
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        storage_path: path,
        file_name: form.file.name,
        file_size: form.file.size,
        mime_type: form.file.type || null,
        document_date: form.document_date || null,
        expires_at: form.expires_at || null,
      } as any);
      if (insertErr) {
        // Si falla el insert, intentamos limpiar el storage
        await supabase.storage.from("employee-documents").remove([path]);
        throw insertErr;
      }

      toast.success("Documento subido");
      setDialogOpen(false);
      resetForm();
      void load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocRow) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-documents")
        .createSignedUrl(doc.storage_path, 60); // URL válida 60s
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("No se pudo generar el enlace");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo descargar");
    }
  };

  const handleDelete = async (doc: DocRow) => {
    if (!confirm(`¿Eliminar "${doc.title}"? No se puede deshacer.`)) return;
    try {
      const { error: delErr } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", doc.id);
      if (delErr) throw delErr;
      // Borrar también del storage (best-effort)
      await supabase.storage.from("employee-documents").remove([doc.storage_path]);
      toast.success("Documento eliminado");
      void load();
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar");
    }
  };

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Documentos</h3>
              <p className="text-xs text-muted-foreground">
                Contratos, nóminas, certificados, formación, RGPD…
              </p>
            </div>
          </div>
          {canManage && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2" size="sm">
              <Plus className="w-4 h-4" />
              Subir
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-6">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Aún no hay documentos guardados.
            {canManage && " Pulsa Subir para añadir el primero."}
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="border rounded-md p-3 flex items-start gap-3 hover:bg-muted/30"
              >
                <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${CATEGORY_COLORS[doc.category] || ""}`}
                    >
                      {CATEGORY_LABELS[doc.category] || doc.category}
                    </Badge>
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                  </div>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                    <span>{doc.file_name}</span>
                    <span>{fmtSize(doc.file_size)}</span>
                    <span>Subido {fmtDate(doc.uploaded_at)}</span>
                    {doc.document_date && (
                      <span>Fecha doc: {fmtDate(doc.document_date)}</span>
                    )}
                    {doc.expires_at && (
                      <span className="text-amber-600">Caduca: {fmtDate(doc.expires_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} title="Descargar">
                    <Download className="w-4 h-4" />
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)} title="Eliminar">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!uploading) setDialogOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>
              El documento queda guardado en almacenamiento privado y solo lo
              ven el empleado y los gestores de la empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="doc-cat">Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger id="doc-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-title">Título *</Label>
              <Input
                id="doc-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Contrato indefinido enero 2026"
              />
            </div>
            <div>
              <Label htmlFor="doc-desc">Descripción</Label>
              <Textarea
                id="doc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="doc-date">Fecha del documento</Label>
                <Input
                  id="doc-date"
                  type="date"
                  value={form.document_date}
                  onChange={(e) => setForm({ ...form, document_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="doc-exp">Fecha de caducidad</Label>
                <Input
                  id="doc-exp"
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="doc-file">Archivo *</Label>
              <Input
                id="doc-file"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) =>
                  setForm({ ...form, file: e.target.files?.[0] || null })
                }
              />
              {form.file && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {form.file.name} · {fmtSize(form.file.size)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Subiendo…" : "Subir documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EmployeeDocumentsCard;
