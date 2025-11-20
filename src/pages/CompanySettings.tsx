import { useEffect, useRef, useState } from "react";
import { useMembership } from "@/hooks/useMembership";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Save, Shield } from "lucide-react";
import { GEOFENCE_RADIUS_METERS } from "@/config/geofence";
import { BackButton } from "@/components/BackButton";

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038]; // Madrid

const CompanySettings = () => {
  useDocumentTitle("Configuración de empresa • GTiQ");
  const { companyId, membership, role } = useMembership();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hqLat, setHqLat] = useState<number | null>(null);
  const [hqLng, setHqLng] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string>("Empresa");

  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) return;
      const { data, error } = await supabase
        .from("companies")
        .select("name, hq_lat, hq_lng")
        .eq("id", companyId)
        .maybeSingle();

      if (error) {
        console.error("Error loading company data", error);
        toast.error("No pudimos cargar la empresa");
        return;
      }

      if (data) {
        setCompanyName(data.name || "Empresa");
        setHqLat(data.hq_lat ?? null);
        setHqLng(data.hq_lng ?? null);
      }
    };

    fetchCompany();
  }, [companyId]);

  useEffect(() => {
    if (mapInstance.current || !mapContainer.current) return;

    const map = L.map(mapContainer.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"https://carto.com/attributions\">CARTO</a>',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setHqLat(lat);
      setHqLng(lng);
      placeMarker(lng, lat);
    });

    mapInstance.current = map;
    setLoadingMap(false);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Colocar marcador cuando haya coordenadas cargadas
  useEffect(() => {
    if (!mapInstance.current) return;
    if (hqLat === null || hqLng === null) return;
    placeMarker(hqLng, hqLat);
    mapInstance.current.setView([hqLat, hqLng], Math.max(mapInstance.current.getZoom(), 13));
  }, [hqLat, hqLng]);

  const placeMarker = (lng: number, lat: number) => {
    if (!mapInstance.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstance.current);
      markerRef.current.on("dragend", () => {
        const location = markerRef.current?.getLatLng();
        if (location) {
          setHqLat(location.lat);
          setHqLng(location.lng);
        }
      });
    }
  };

  const handleSave = async () => {
    if (!companyId) {
      toast.error("No se encontró la empresa activa");
      return;
    }

    if (hqLat === null || hqLng === null) {
      toast.error("Selecciona una ubicación en el mapa");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ hq_lat: hqLat, hq_lng: hqLng })
        .eq("id", companyId);

      if (error) throw error;
      toast.success("Ubicación guardada");
    } catch (err) {
      console.error(err);
      toast.error("No pudimos guardar la ubicación");
    } finally {
      setSaving(false);
    }
  };

  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-5xl mx-auto space-y-6 pt-8">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <MapPin className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Ubicación de la empresa</h1>
            <p className="text-sm text-muted-foreground">Define el punto central para validar fichajes.</p>
          </div>
        </div>

        <Card className="glass-card p-6 space-y-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Empresa</p>
            <p className="text-lg font-semibold">{companyName}</p>
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div ref={mapContainer} className="h-[400px] w-full" />
          </div>
          {loadingMap && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando mapa...
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Latitud</Label>
              <Input value={hqLat ?? ""} readOnly placeholder="Selecciona en el mapa" />
            </div>
            <div className="space-y-2">
              <Label>Longitud</Label>
              <Input value={hqLng ?? ""} readOnly placeholder="Selecciona en el mapa" />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-primary" />
            <span>
              El radio de validación de fichaje es de <strong>{GEOFENCE_RADIUS_METERS} metros</strong> alrededor de este punto.
            </span>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!canEdit || saving || hqLat === null || hqLng === null}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar ubicación
            </Button>
          </div>
          {!canEdit && <p className="text-xs text-muted-foreground">Solo los owners/admin pueden editar la ubicación.</p>}
        </Card>
      </div>
    </div>
  );
};

export default CompanySettings;
