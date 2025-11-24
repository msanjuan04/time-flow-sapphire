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
import OwnerQuickNav from "@/components/OwnerQuickNav";

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038]; // Madrid

const markerIconInline = L.divIcon({
  className: "hq-marker",
  html: `<div style="
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background: #2563eb;
    border: 3px solid #0f172a;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

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
      markerRef.current = L.marker([lat, lng], { draggable: true, icon: markerIconInline }).addTo(mapInstance.current);
      markerRef.current.on("dragend", () => {
        const location = markerRef.current?.getLatLng();
        if (location) {
          setHqLat(location.lat);
          setHqLng(location.lng);
        }
      });
    }
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setHqLat(latitude);
        setHqLng(longitude);
        placeMarker(longitude, latitude);
        mapInstance.current?.setView([latitude, longitude], Math.max(mapInstance.current.getZoom(), 15));
        setLocating(false);
      },
      () => {
        toast.error("No pudimos obtener tu ubicación");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      toast.error("Introduce una dirección o lugar");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        toast.error("No encontramos esa ubicación");
        return;
      }
      const match = data[0];
      const lat = Number(match.lat);
      const lon = Number(match.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        toast.error("No pudimos leer las coordenadas");
        return;
      }
      setHqLat(lat);
      setHqLng(lon);
      placeMarker(lon, lat);
      mapInstance.current?.setView([lat, lon], Math.max(mapInstance.current.getZoom(), 15));
    } catch (error) {
      console.error("Search geocode error:", error);
      toast.error("No pudimos buscar esa dirección");
    } finally {
      setSearching(false);
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

        <OwnerQuickNav />

        <Card className="glass-card p-6 space-y-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Empresa</p>
            <p className="text-lg font-semibold">{companyName}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="search-address">Buscar dirección o lugar</Label>
              <div className="flex gap-2">
                <Input
                  id="search-address"
                  placeholder="Ej. Gran Vía, Madrid"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <Button type="button" onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Usa el buscador o toca el mapa para colocar la sede.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Usar mi ubicación</Label>
              <Button type="button" variant="secondary" className="w-full" onClick={handleGeolocate} disabled={locating}>
                {locating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {locating ? "Obteniendo ubicación..." : "Detectar ubicación actual"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Si das permisos al navegador, colocamos la chincheta donde estás ahora.
              </p>
            </div>
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
