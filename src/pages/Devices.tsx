import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tablet, ArrowLeft, Plus, QrCode, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

interface Device {
  id: string;
  name: string;
  type: string;
  center_id: string | null;
  secret_hash: string;
  last_seen_at: string | null;
  created_at: string;
  centers?: {
    name: string;
  };
}

interface Center {
  id: string;
  name: string;
}

const Devices = () => {
  const { user } = useAuth();
  const { companyId } = useMembership();
  const navigate = useNavigate();

  const [devices, setDevices] = useState<Device[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewDevice, setShowNewDevice] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Form state
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<"kiosk" | "mobile">("kiosk");
  const [deviceCenter, setDeviceCenter] = useState<string>("");

  useEffect(() => {
    if (companyId) {
      fetchDevices();
      fetchCenters();
    }
  }, [companyId]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("devices")
        .select(`
          *,
          centers(name)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Error al cargar dispositivos");
    } finally {
      setLoading(false);
    }
  };

  const fetchCenters = async () => {
    const { data } = await supabase
      .from("centers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    setCenters(data || []);
  };

  const generatePIN = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceName.trim()) {
      toast.error("Ingresa un nombre para el dispositivo");
      return;
    }

    setLoading(true);
    try {
      const pin = generatePIN();

      const { error } = await supabase.from("devices").insert({
        company_id: companyId,
        name: deviceName,
        type: deviceType,
        center_id: deviceCenter || null,
        secret_hash: pin,
        meta: {
          created_by: user?.id,
        },
      });

      if (error) throw error;

      toast.success("Dispositivo creado correctamente");
      setShowNewDevice(false);
      setDeviceName("");
      setDeviceType("kiosk");
      setDeviceCenter("");
      fetchDevices();
    } catch (error: any) {
      console.error("Error creating device:", error);
      toast.error(error.message || "Error al crear dispositivo");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("¿Estás seguro de eliminar este dispositivo?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("devices")
        .delete()
        .eq("id", deviceId);

      if (error) throw error;

      toast.success("Dispositivo eliminado");
      fetchDevices();
    } catch (error: any) {
      console.error("Error deleting device:", error);
      toast.error(error.message || "Error al eliminar dispositivo");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const getKioskURL = (pin: string) => {
    return `${window.location.origin}/kiosk?pin=${pin}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Tablet className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gestión de Dispositivos</h1>
              <p className="text-sm text-muted-foreground">
                Configura tablets y dispositivos kiosko
              </p>
            </div>
          </div>
          <Dialog open={showNewDevice} onOpenChange={setShowNewDevice}>
            <DialogTrigger asChild>
              <Button className="hover-scale">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Dispositivo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateDevice}>
                <DialogHeader>
                  <DialogTitle>Crear Dispositivo</DialogTitle>
                  <DialogDescription>
                    Configura un nuevo dispositivo kiosko o móvil
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="name">Nombre del dispositivo</Label>
                    <Input
                      id="name"
                      placeholder="Ej: Tablet Entrada Principal"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={deviceType}
                      onValueChange={(v: "kiosk" | "mobile") => setDeviceType(v)}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kiosk">Kiosko (Tablet)</SelectItem>
                        <SelectItem value="mobile">Móvil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="center">Centro (opcional)</Label>
                    <Select value={deviceCenter} onValueChange={setDeviceCenter}>
                      <SelectTrigger id="center">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin asignar</SelectItem>
                        {centers.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            {center.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowNewDevice(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creando..." : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Devices Table */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Dispositivos configurados</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando dispositivos...
                    </TableCell>
                  </TableRow>
                ) : devices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay dispositivos configurados
                    </TableCell>
                  </TableRow>
                ) : (
                  devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.name}</TableCell>
                      <TableCell>
                        <Badge variant={device.type === "kiosk" ? "default" : "secondary"}>
                          {device.type === "kiosk" ? "Kiosko" : "Móvil"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {device.centers?.name || (
                          <span className="text-muted-foreground">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-secondary rounded text-sm font-mono">
                            {device.secret_hash}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(device.secret_hash)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {device.last_seen_at ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(device.last_seen_at).toLocaleDateString("es-ES")}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nunca</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowQRDialog(true);
                            }}
                          >
                            <QrCode className="w-4 h-4 mr-1" />
                            QR
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDevice(device.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* QR Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Código QR - {selectedDevice?.name}</DialogTitle>
              <DialogDescription>
                Escanea este código QR para acceder al kiosko
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {selectedDevice && (
                <>
                  <div className="p-4 bg-white rounded-lg">
                    <QRCodeSVG
                      value={getKioskURL(selectedDevice.secret_hash)}
                      size={256}
                      level="H"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label>PIN de acceso</Label>
                    <div className="flex gap-2">
                      <Input
                        value={selectedDevice.secret_hash}
                        readOnly
                        className="font-mono text-center text-lg"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(selectedDevice.secret_hash)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 w-full">
                    <Label>URL del kiosko</Label>
                    <div className="flex gap-2">
                      <Input
                        value={getKioskURL(selectedDevice.secret_hash)}
                        readOnly
                        className="text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(getKioskURL(selectedDevice.secret_hash))
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Devices;
