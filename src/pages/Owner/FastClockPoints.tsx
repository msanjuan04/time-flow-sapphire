import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import OwnerQuickNav from "@/components/OwnerQuickNav";
import { useMembership } from "@/hooks/useMembership";
import { Loader2, QrCode, MapPin, Link as LinkIcon, Info, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const FASTCLOCK_BASE_URL = "https://gneraitiq.com/fastclock/";

type ClockPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
};

const getClockPoints = async (companyId: string): Promise<ClockPoint[]> => {
  const { data, error } = await supabase
    .from("fastclock_points" as any)
    .select("id, name, latitude, longitude, radius_meters, active")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    radius_meters: Number(p.radius_meters),
    active: Boolean(p.active),
  }));
};

const createClockPoint = async (
  companyId: string,
  payload: { name: string; latitude: number; longitude: number; radius_meters: number; active: boolean }
) => {
  const { data, error } = await supabase
    .from("fastclock_points" as any)
    .insert({
      company_id: companyId,
      name: payload.name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      radius_meters: payload.radius_meters,
      active: payload.active,
    })
    .select("id, name, latitude, longitude, radius_meters, active")
    .maybeSingle();
  if (error) throw error;
  return {
    id: data!.id,
    name: data!.name,
    latitude: Number(data!.latitude),
    longitude: Number(data!.longitude),
    radius_meters: Number(data!.radius_meters),
    active: Boolean(data!.active),
  } as ClockPoint;
};

const updateClockPoint = async (companyId: string, pointId: string, payload: Partial<ClockPoint>) => {
  const { data, error } = await supabase
    .from("fastclock_points" as any)
    .update({
      name: payload.name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      radius_meters: payload.radius_meters,
      active: payload.active,
    })
    .eq("company_id", companyId)
    .eq("id", pointId)
    .select("id, name, latitude, longitude, radius_meters, active")
    .maybeSingle();
  if (error) throw error;
  return {
    id: data!.id,
    name: data!.name,
    latitude: Number(data!.latitude),
    longitude: Number(data!.longitude),
    radius_meters: Number(data!.radius_meters),
    active: Boolean(data!.active),
  } as ClockPoint;
};

const FastClockPoints = () => {
  useDocumentTitle("Puntos de fichaje • FastClock");
  const { companyId, role, loading: membershipLoading } = useMembership();
  const [points, setPoints] = useState<ClockPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClockPoint | null>(null);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("200");
  const [active, setActive] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      setLoading(true);
      try {
        const data = await getClockPoints(companyId);
        setPoints(data);
      } catch (err) {
        console.error("No se pudieron cargar los puntos", err);
        toast.error("No se pudieron cargar los puntos de fichaje");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setLatitude("");
    setLongitude("");
    setRadius("200");
    setActive(true);
    setDialogOpen(true);
  };

  const openEdit = (point: ClockPoint) => {
    setEditing(point);
    setName(point.name);
    setLatitude(point.latitude.toString());
    setLongitude(point.longitude.toString());
    setRadius(point.radius_meters.toString());
    setActive(point.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) {
      toast.error("Falta empresa activa");
      return;
    }
    if (!name.trim()) {
      toast.error("Añade un nombre para el punto");
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    const radiusMeters = Number(radius);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Introduce una latitud y longitud válidas");
      return;
    }
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      toast.error("Introduce un radio válido en metros");
      return;
    }
    try {
      if (editing) {
        const updated = await updateClockPoint(companyId, editing.id, {
          name: name.trim(),
          latitude: lat,
          longitude: lng,
          radius_meters: radiusMeters,
          active,
        });
        setPoints((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...updated } : p)));
        toast.success("Punto actualizado");
      } else {
        const created = await createClockPoint(companyId, {
          name: name.trim(),
          latitude: lat,
          longitude: lng,
          radius_meters: radiusMeters,
          active,
        });
        setPoints((prev) => [...prev, created]);
        toast.success("Punto creado");
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Error guardando punto", err);
      toast.error("No se pudo guardar el punto");
    }
  };

  const selectedPoint = useMemo(() => (editing ? points.find((p) => p.id === editing.id) : null), [editing, points]);

  const renderStatus = (p: ClockPoint) => (
    <Badge variant={p.active ? "default" : "secondary"} className="capitalize">
      {p.active ? "Activo" : "Inactivo"}
    </Badge>
  );

  const renderLink = (pointId: string) => `${FASTCLOCK_BASE_URL}${pointId}`;

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
                <QrCode className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">FastClock</p>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Puntos de fichaje</h1>
                <p className="text-sm text-muted-foreground">Genera enlaces para QR o NFC y controla su estado.</p>
              </div>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Nuevo punto
          </Button>
        </div>
        <OwnerQuickNav />
      </div>

      <Card className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando puntos...
          </div>
        ) : points.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aún no hay puntos de fichaje.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Coordenadas</TableHead>
                <TableHead>Radio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                  </TableCell>
                  <TableCell>{Math.round(p.radius_meters)} m</TableCell>
                  <TableCell>{renderStatus(p)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      Ver / Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {selectedPoint && (
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Detalle</p>
              <h2 className="text-lg font-semibold">{selectedPoint.name}</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Estado</p>
              {renderStatus(selectedPoint)}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Coordenadas</p>
              <p className="text-sm">
                {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Radio</p>
              <p className="text-sm">{Math.round(selectedPoint.radius_meters)} m</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> URL de fichaje
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3 bg-muted/50">
                <p className="text-sm break-all">{renderLink(selectedPoint.id)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(renderLink(selectedPoint.id));
                    toast.success("URL copiada");
                  }}
                >
                  Copiar enlace
                </Button>
              </div>
            </div>
            <div className="sm:col-span-1 flex flex-col items-center gap-2">
              <QRCodeSVG value={renderLink(selectedPoint.id)} size={180} />
              <p className="text-xs text-muted-foreground text-center">Usa este QR en cartelería o accesos.</p>
            </div>
            <div className="sm:col-span-1 rounded-lg border p-3 space-y-2 bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-4 h-4 text-primary" />
                Instrucciones NFC
              </div>
              <p className="text-sm text-muted-foreground">
                Graba esta URL en una etiqueta NFC compatible y colócala en el punto de fichaje.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar punto de fichaje" : "Nuevo punto de fichaje"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre del punto</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Entrada principal" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Latitud</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="Ej. 40.41678"
                />
              </div>
              <div className="space-y-1">
                <Label>Longitud</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="Ej. -3.70379"
                />
              </div>
              <div className="space-y-1">
                <Label>Radio (metros)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  placeholder="200"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <Label>Estado</Label>
                <p className="text-xs text-muted-foreground">Activa o desactiva el punto sin borrarlo.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="w-4 h-4" />
              Se genera un ID único (pointId) que se usa en los enlaces QR/NFC.
            </div>
            <Button onClick={handleSave}>{editing ? "Guardar cambios" : "Crear punto"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FastClockPoints;
