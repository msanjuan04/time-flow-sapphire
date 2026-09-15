import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import OwnerQuickNav from "@/components/OwnerQuickNav";
import { useMembership } from "@/hooks/useMembership";
import { Loader2, Plus, Trash2, Wifi, QrCode, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cardMatchesUid, findCardForUid, normalizeUid } from "../../../supabase/functions/_shared/nfcCards";

const NFC_BASE_URL = "https://gneraitiq.com/nfc/";

// La normalización y la comparación son las MISMAS que usa el servidor al
// fichar: si esta pantalla dice que una tarjeta está bien, el kiosco la
// tiene que reconocer igual.
const normalizeNfcUid = normalizeUid;

type ProfileRow = { id: string; full_name: string | null; email: string | null };

type Comprobacion =
  | { estado: "reconocida"; cardId: string; nombre: string; etiqueta: string | null; uid: string }
  | { estado: "desconocida"; uid: string }
  | { estado: "inactiva"; nombre: string; uid: string };

type NfcCardRow = {
  id: string;
  user_id: string;
  card_uid: string;
  card_uid_normalized?: string | null;
  uid?: string | null;
  label: string | null;
  active: boolean;
  profile?: { full_name: string | null; email: string | null };
};

type ClockPoint = {
  id: string;
  name: string;
  active: boolean;
};

const getClockPoints = async (companyId: string): Promise<ClockPoint[]> => {
  const { data, error } = await supabase
    .from("fastclock_points")
    .select("id, name, active")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    active: Boolean(p.active),
  }));
};

const loadEmployees = async (companyId: string): Promise<ProfileRow[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, memberships!inner(company_id)")
    .eq("memberships.company_id", companyId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data || []) as ProfileRow[];
};

const loadNfcCards = async (companyId: string): Promise<NfcCardRow[]> => {
  const { data: rows, error } = await supabase
    .from("nfc_cards")
    .select("id, user_id, card_uid, card_uid_normalized, uid, label, active")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (rows || []) as unknown as Omit<NfcCardRow, "profile">[];
  const ids = [...new Set(list.map((r) => r.user_id))];
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (ids.length > 0) {
    const { data: profs, error: pe } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    if (pe) throw pe;
    for (const p of profs || []) {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }
  return list.map((r) => ({
    ...r,
    profile: profileMap.get(r.user_id),
  }));
};

const NfcCardsPage = () => {
  useDocumentTitle("Tarjetas NFC");
  const { companyId, role, loading: membershipLoading } = useMembership();
  const [cards, setCards] = useState<NfcCardRow[]>([]);
  const [points, setPoints] = useState<ClockPoint[]>([]);
  const [employees, setEmployees] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [uidRaw, setUidRaw] = useState("");
  const [label, setLabel] = useState("");
  const [listeningNfc, setListeningNfc] = useState(false);
  // Comprobación de tarjetas: el jefe las pasa todas seguidas y ve de
  // quién es cada una. No llama al servidor ni registra ningún fichaje.
  const [comprobando, setComprobando] = useState(false);
  const [ultima, setUltima] = useState<Comprobacion | null>(null);
  const [comprobadas, setComprobadas] = useState<Set<string>>(new Set());
  const [desconocidas, setDesconocidas] = useState<string[]>([]);
  const comprobarBufferRef = useRef("");
  const enrollBufferRef = useRef("");

  const [qrOpen, setQrOpen] = useState(false);
  const [qrTitle, setQrTitle] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  const normalizedPreview = useMemo(() => normalizeNfcUid(uidRaw), [uidRaw]);

  const refreshAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [c, p, e] = await Promise.all([
        loadNfcCards(companyId),
        getClockPoints(companyId),
        loadEmployees(companyId),
      ]);
      setCards(c);
      setPoints(p);
      setEmployees(e);
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // El lector USB escribe como un teclado: se escucha en toda la página,
  // así no hay que acertar con el foco de ningún campo.
  useEffect(() => {
    if (!comprobando) {
      comprobarBufferRef.current = "";
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const leido = comprobarBufferRef.current.trim();
        comprobarBufferRef.current = "";
        if (!leido) return;

        const uid = normalizeUid(leido);
        const card = findCardForUid(cards, leido);
        if (card) {
          const nombre = card.profile?.full_name?.trim() || card.profile?.email || "Sin nombre";
          setUltima({ estado: "reconocida", cardId: card.id, nombre, etiqueta: card.label, uid });
          setComprobadas((prev) => new Set(prev).add(card.id));
          return;
        }

        // Puede estar dada de alta pero desactivada: findCardForUid la
        // descarta, y conviene decirlo en vez de "desconocida".
        const inactiva = cards.find((c) => cardMatchesUid({ ...c, active: true }, leido));
        if (inactiva) {
          setUltima({
            estado: "inactiva",
            nombre: inactiva.profile?.full_name?.trim() || inactiva.profile?.email || "Sin nombre",
            uid,
          });
          return;
        }

        setUltima({ estado: "desconocida", uid });
        setDesconocidas((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        comprobarBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [comprobando, cards]);

  useEffect(() => {
    if (!dialogOpen || !listeningNfc) {
      enrollBufferRef.current = "";
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const raw = enrollBufferRef.current;
        enrollBufferRef.current = "";
        setUidRaw(raw);
        setListeningNfc(false);
        if (raw.trim()) toast.success("UID capturado");
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        enrollBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [dialogOpen, listeningNfc]);

  const openCreate = () => {
    setSelectedUserId("");
    setUidRaw("");
    setLabel("");
    setListeningNfc(false);
    enrollBufferRef.current = "";
    setDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!companyId) {
      toast.error("Falta empresa activa");
      return;
    }
    if (!selectedUserId) {
      toast.error("Selecciona un empleado");
      return;
    }
    const card_uid = normalizeNfcUid(uidRaw);
    if (!card_uid) {
      toast.error("Introduce o captura un UID válido");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("nfc_cards").insert({
        company_id: companyId,
        user_id: selectedUserId,
        card_uid,
        card_uid_normalized: card_uid,
        uid: card_uid,
        label: label.trim() || null,
        active: true,
      });
      if (error) throw error;
      toast.success("Tarjeta añadida");
      setDialogOpen(false);
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message?.includes("duplicate") ? "Ese UID ya está registrado" : "No se pudo añadir la tarjeta");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: NfcCardRow, active: boolean) => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from("nfc_cards")
        .update({ active })
        .eq("id", row.id)
        .eq("company_id", companyId);
      if (error) throw error;
      setCards((prev) => prev.map((c) => (c.id === row.id ? { ...c, active } : c)));
      toast.success(active ? "Tarjeta activada" : "Tarjeta desactivada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleDelete = async (row: NfcCardRow) => {
    if (!companyId) return;
    try {
      const { error } = await supabase.from("nfc_cards").delete().eq("id", row.id).eq("company_id", companyId);
      if (error) throw error;
      setCards((prev) => prev.filter((c) => c.id !== row.id));
      toast.success("Tarjeta eliminada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar la tarjeta");
    }
  };

  const openQr = (p: ClockPoint) => {
    const url = `${NFC_BASE_URL}${p.id}`;
    setQrTitle(p.name);
    setQrUrl(url);
    setQrOpen(true);
  };

  const employeeLabel = (p: ProfileRow) => p.full_name?.trim() || p.email || p.id;

  if (membershipLoading) {
    return (
      <div className="p-6">
        <Card className="p-6 flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando empresa...
        </Card>
      </div>
    );
  }

  if (role !== "owner" && role !== "admin" && role !== "manager") {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">No tienes permisos para ver esta sección.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <BackButton />
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Wifi className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">NFC</p>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Tarjetas NFC</h1>
                <p className="text-sm text-muted-foreground">Enlaza tarjetas a empleados y enlaces de terminales USB.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant={comprobando ? "default" : "outline"}
              onClick={() => {
                setComprobando((v) => !v);
                setUltima(null);
                setComprobadas(new Set());
                setDesconocidas([]);
              }}
              className="gap-2 w-full sm:w-auto"
            >
              <Wifi className="w-4 h-4" />
              {comprobando ? "Terminar comprobación" : "Comprobar tarjetas"}
            </Button>
            <Button onClick={openCreate} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Añadir tarjeta
            </Button>
          </div>
        </div>
        <OwnerQuickNav />
      </div>

      {comprobando && (
        <Card className="p-4 sm:p-6 space-y-4 border-primary/50 bg-primary/5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Comprobando tarjetas</h2>
              <p className="text-sm text-muted-foreground">
                Pásalas una a una por el lector. <strong>No se registra ningún fichaje</strong>, solo se
                comprueba de quién es cada tarjeta.
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums">
              {comprobadas.size} de {cards.filter((c) => c.active).length} comprobadas
            </p>
          </div>

          <div className="rounded-xl border bg-background p-4 sm:p-6 text-center min-h-[120px] flex flex-col items-center justify-center gap-1">
            {!ultima && (
              <p className="text-muted-foreground">Esperando tarjeta…</p>
            )}
            {ultima?.estado === "reconocida" && (
              <>
                <p className="text-4xl">✅</p>
                <p className="text-xl sm:text-2xl font-bold">{ultima.nombre}</p>
                <p className="text-sm text-muted-foreground">{ultima.etiqueta || "sin etiqueta"}</p>
              </>
            )}
            {ultima?.estado === "inactiva" && (
              <>
                <p className="text-4xl">⚠️</p>
                <p className="text-xl font-bold text-amber-600">Tarjeta desactivada</p>
                <p className="text-sm text-muted-foreground">
                  Es de {ultima.nombre}. Actívala abajo o no podrá fichar con ella.
                </p>
              </>
            )}
            {ultima?.estado === "desconocida" && (
              <>
                <p className="text-4xl">❌</p>
                <p className="text-xl font-bold text-destructive">Tarjeta sin dar de alta</p>
                <p className="text-sm text-muted-foreground">
                  Nadie la tiene asignada en esta empresa.
                </p>
              </>
            )}
            {ultima && (
              <code className="text-xs bg-muted px-2 py-1 rounded mt-1">{ultima.uid}</code>
            )}
          </div>

          {desconocidas.length > 0 && (
            <div className="text-sm">
              <p className="font-medium mb-1">Sin dar de alta ({desconocidas.length})</p>
              <div className="flex flex-wrap gap-2">
                {desconocidas.map((uid) => (
                  <code key={uid} className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">
                    {uid}
                  </code>
                ))}
              </div>
            </div>
          )}

          {cards.filter((c) => c.active && !comprobadas.has(c.id)).length > 0 && (
            <div className="text-sm">
              <p className="font-medium mb-1">Aún sin pasar</p>
              <div className="flex flex-wrap gap-2">
                {cards
                  .filter((c) => c.active && !comprobadas.has(c.id))
                  .map((c) => (
                    <span key={c.id} className="text-xs border border-border/60 rounded-full px-2 py-1">
                      {c.label || c.profile?.full_name?.trim() || c.profile?.email || c.card_uid}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Tarjetas registradas</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando tarjetas...
          </div>
        ) : cards.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aún no hay tarjetas NFC para esta empresa.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>UID normalizado</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.profile?.full_name?.trim() || row.profile?.email || row.user_id}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{row.card_uid}</code>
                  </TableCell>
                  <TableCell>{row.label || "—"}</TableCell>
                  <TableCell>
                    <Switch checked={row.active} onCheckedChange={(v) => handleToggleActive(row, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(row)} aria-label="Eliminar tarjeta">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Terminales</p>
            <h2 className="text-lg font-semibold">Terminales NFC</h2>
            <p className="text-sm text-muted-foreground">
              Abre esta URL en el PC o tablet con lector USB. Los puntos coinciden con los de FastClock.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando puntos...
          </div>
        ) : points.length === 0 ? (
          <div className="text-sm text-muted-foreground">No hay puntos de fichaje. Créalos en FastClock.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Punto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>URL NFC</TableHead>
                <TableHead className="text-right">QR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((p) => {
                const url = `${NFC_BASE_URL}${p.id}`;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm break-all flex-1">{url}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => {
                            void navigator.clipboard.writeText(url);
                            toast.success("URL copiada");
                          }}
                        >
                          <LinkIcon className="w-4 h-4 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => openQr(p)}>
                        <QrCode className="w-4 h-4 mr-1" />
                        Ver QR
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir tarjeta NFC</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {employeeLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>UID de la tarjeta</Label>
                <Button
                  type="button"
                  size="sm"
                  variant={listeningNfc ? "default" : "outline"}
                  className="gap-1"
                  onClick={() => setListeningNfc((v) => !v)}
                >
                  <Wifi className="w-4 h-4" />
                  {listeningNfc ? "Capturando…" : "Capturar lector"}
                </Button>
              </div>
              <Input
                value={uidRaw}
                onChange={(e) => setUidRaw(e.target.value)}
                placeholder="Pega o escribe el UID"
                readOnly={listeningNfc}
                className={listeningNfc ? "opacity-80" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Normalizado: <code className="text-foreground">{normalizedPreview || "—"}</code>
              </p>
              {listeningNfc ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">Pasa la tarjeta por el lector USB (o pulsa de nuevo para cancelar).</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Etiqueta (opcional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Llavero recepción" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleAdd()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR · {qrTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <QRCodeSVG value={qrUrl} size={200} />
            <p className="text-xs text-muted-foreground text-center break-all">{qrUrl}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(qrUrl);
                toast.success("URL copiada");
              }}
            >
              Copiar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NfcCardsPage;
