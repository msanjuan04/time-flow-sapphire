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
import { Loader2, MapPin, Save, Shield, Timer } from "lucide-react";
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
  const [maxShiftHours, setMaxShiftHours] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) return;
      const load = async (withLogo: boolean) =>
        supabase
          .from("companies")
          .select(
            withLogo ? "name, hq_lat, hq_lng, max_shift_hours, logo_url" : "name, hq_lat, hq_lng, max_shift_hours"
          )
          .eq("id", companyId)
          .maybeSingle();

      let { data, error } = await load(true);

      // Si la columna logo_url aún no existe en la BD, reintenta sin ella para no romper la vista.
      if (error && (error.code === "42703" || `${error.message}`.toLowerCase().includes("logo_url"))) {
        console.warn("logo_url column missing, retrying without it. Add it in Supabase.");
        ({ data, error } = await load(false));
      }

      if (error) {
        console.error("Error loading company data", error);
        toast.error("No pudimos cargar la empresa");
        return;
      }

      if (data) {
        setCompanyName(data.name || "Empresa");
        setHqLat(data.hq_lat ?? null);
        setHqLng(data.hq_lng ?? null);
        setMaxShiftHours(
          typeof data.max_shift_hours === "number" && !Number.isNaN(data.max_shift_hours)
            ? String(Number(data.max_shift_hours))
            : ""
        );
        // Si la columna no existe, data no trae logo_url; mantenemos lo que haya.
        // @ts-expect-error: logo_url puede no venir si la columna no existe aún
        setLogoUrl(data.logo_url ?? null);
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

  const handleLogoUpload = async (file: File) => {
    if (!companyId) {
      toast.error("No se encontró la empresa activa");
      return;
    }
    setUploadingLogo(true);
    try {
      if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
        toast.error("Solo se admiten imágenes PNG/JPG/WebP");
        setUploadingLogo(false);
        return;
      }
      const ext = file.name.split(".").pop() || "png";
      const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("company-logos").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("company-logos").getPublicUrl(path);
      const publicUrl = publicData.publicUrl;
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("id", companyId);
      if (updateError) throw updateError;
      setLogoUrl(publicUrl);
      toast.success("Logo actualizado");
    } catch (error) {
      console.error("Logo upload error", error);
      toast.error("No pudimos subir el logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!companyId) return;
    try {
      const { error } = await supabase.from("companies").update({ logo_url: null }).eq("id", companyId);
      if (error) throw error;
      setLogoUrl(null);
      toast.success("Logo eliminado");
    } catch (error) {
      console.error("Remove logo error", error);
      toast.error("No pudimos eliminar el logo");
    }
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

    setSaving(true);
    try {
      const payload: Record<string, any> = {};

      // Solo actualiza la geovalla si el usuario la ha definido; permite guardar aunque no tenga ubicación
      if (hqLat !== null && hqLng !== null) {
        payload.hq_lat = hqLat;
        payload.hq_lng = hqLng;
      }

      const normalized = maxShiftHours.replace(",", ".").trim();

      if (normalized === "") {
        payload.max_shift_hours = null;
      } else {
        const parsed = Number(normalized);
        if (Number.isNaN(parsed) || parsed <= 0) {
          toast.error("El límite de horas debe ser un número mayor que 0 (usa punto o coma para decimales)");
          setSaving(false);
          return;
        }
        payload.max_shift_hours = parsed;
      }

      const { error } = await supabase.from("companies").update(payload).eq("id", companyId);

      if (error) throw error;
      toast.success("Configuración guardada");
    } catch (err) {
      console.error(err);
      toast.error("No pudimos guardar la configuración");
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

        <Card className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-11 h-11 object-contain rounded" />
                ) : (
                  <Shield className="w-6 h-6 text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">Logo de la empresa</h2>
                <p className="text-sm text-muted-foreground">Sube o cambia el logo para owners y workers.</p>
              </div>
            </div>
            <div className="flex gap-2">
              {logoUrl && (
                <Button variant="outline" onClick={handleRemoveLogo} disabled={!canEdit || uploadingLogo}>
                  Quitar logo
                </Button>
              )}
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!canEdit || uploadingLogo}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleLogoUpload(file);
                  } else {
                    toast.error("No se seleccionó ningún archivo");
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canEdit || uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {logoUrl ? "Cambiar logo" : "Subir logo"}
              </Button>
            </div>
          </div>
        </Card>

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
            <Button onClick={handleSave} disabled={!canEdit || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar configuración
            </Button>
          </div>
          {!canEdit && <p className="text-xs text-muted-foreground">Solo los owners/admin pueden editar la ubicación.</p>}
        </Card>

        <Card className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-sm">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Límite máximo por fichada</h2>
              <p className="text-sm text-muted-foreground">
                Si se supera, la fichada se marca para revisión y el trabajador no puede cerrarla. Deja en blanco para desactivar.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="maxShiftHours">Horas máximas</Label>
              <Input
                id="maxShiftHours"
                type="number"
                min="0"
                step="0.5"
                value={maxShiftHours}
                onChange={(e) => setMaxShiftHours(e.target.value)}
                placeholder="Ej. 13"
                disabled={!canEdit}
              />
            </div>
            <p className="text-sm text-muted-foreground md:col-span-2">
              Campo opcional. Si lo dejas vacío, el sistema no aplica bloqueo por límite de horas.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!canEdit || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar límite
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default CompanySettings;
