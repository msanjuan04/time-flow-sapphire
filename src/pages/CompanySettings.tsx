import { useEffect, useRef, useState } from "react";
import { useMembership } from "@/hooks/useMembership";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Save, Shield, Timer } from "lucide-react";
import { GEOFENCE_RADIUS_METERS } from "@/config/geofence";
import { BackButton } from "@/components/BackButton";
import OwnerQuickNav from "@/components/OwnerQuickNav";
import { getComplianceSettings, updateComplianceSettings } from "@/lib/compliance";
import {
  getCompanyDayRules,
  getWorkerDayRules,
  upsertCompanyDayRules,
  upsertWorkerDayRule,
  HolidayPolicy,
  SpecialDayPolicy,
  WorkerDayRules,
} from "@/lib/dayRules";

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
  const [keepSessionsOpen, setKeepSessionsOpen] = useState<boolean>(false);
  const [keepSessionsDays, setKeepSessionsDays] = useState<number>(5);
  const [entryEarly, setEntryEarly] = useState<number>(10);
  const [entryLate, setEntryLate] = useState<number>(15);
  const [exitEarly, setExitEarly] = useState<number>(10);
  const [exitLate, setExitLate] = useState<number>(15);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showKeepSessionsModal, setShowKeepSessionsModal] = useState(false);
  const pendingKeepSessionsValue = useRef<boolean>(false);
  // Compliance settings (owner only)
  const [compLoading, setCompLoading] = useState(false);
  const [compSaving, setCompSaving] = useState(false);
  const [maxWeekHours, setMaxWeekHours] = useState("");
  const [maxMonthHours, setMaxMonthHours] = useState("");
  const [minBetweenShifts, setMinBetweenShifts] = useState("");
  const [allowedStart, setAllowedStart] = useState("");
  const [allowedEnd, setAllowedEnd] = useState("");
  const [allowOutsideSchedule, setAllowOutsideSchedule] = useState(true);
  // Day rules (owner)
  const [dayLoading, setDayLoading] = useState(false);
  const [daySaving, setDaySaving] = useState(false);
  const [allowSunday, setAllowSunday] = useState(false);
  const [holidayPolicy, setHolidayPolicy] = useState<HolidayPolicy>("block");
  const [specialPolicy, setSpecialPolicy] = useState<SpecialDayPolicy>("restrict");
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerList, setWorkerList] = useState<{ user_id: string; full_name: string; email: string; role: string }[]>([]);
  const [workerRules, setWorkerRules] = useState<Record<string, WorkerDayRules>>({});
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
  const [workerSaving, setWorkerSaving] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<{ user_id: string; full_name: string; email: string } | null>(null);
  const [workerAllowSunday, setWorkerAllowSunday] = useState<"inherit" | boolean>("inherit");
  const [workerHoliday, setWorkerHoliday] = useState<"inherit" | HolidayPolicy>("inherit");
  const [workerSpecial, setWorkerSpecial] = useState<"inherit" | SpecialDayPolicy>("inherit");

  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) return;
      const load = async (withLogo: boolean) =>
        supabase
          .from("companies")
          .select(
            withLogo
              ? "name, hq_lat, hq_lng, max_shift_hours, logo_url, keep_sessions_open, keep_sessions_days, entry_early_minutes, entry_late_minutes, exit_early_minutes, exit_late_minutes"
              : "name, hq_lat, hq_lng, max_shift_hours"
          )
          .eq("id", companyId)
          .maybeSingle();

      let { data, error } = await load(true);

      // Si la columna logo_url aún no existe en la BD, reintenta sin ella para no romper la vista.
      if (
        error &&
        (error.code === "42703" ||
          `${error.message}`.toLowerCase().includes("logo_url") ||
          `${error.message}`.toLowerCase().includes("keep_sessions_open"))
      ) {
        console.warn("Alguna columna falta (logo_url/keep_sessions_open), reintentando sin ella. Añádela en Supabase.");
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
        if (typeof data.keep_sessions_open === "boolean") {
          setKeepSessionsOpen(Boolean(data.keep_sessions_open));
        }
        if (typeof data.keep_sessions_days === "number" && !Number.isNaN(data.keep_sessions_days)) {
          setKeepSessionsDays(data.keep_sessions_days);
        }
        if (typeof data.entry_early_minutes === "number") setEntryEarly(data.entry_early_minutes);
        if (typeof data.entry_late_minutes === "number") setEntryLate(data.entry_late_minutes);
        if (typeof data.exit_early_minutes === "number") setExitEarly(data.exit_early_minutes);
        if (typeof data.exit_late_minutes === "number") setExitLate(data.exit_late_minutes);
        // Si la columna no existe, data no trae logo_url; mantenemos lo que haya.
        // @ts-expect-error: logo_url puede no venir si la columna no existe aún
        setLogoUrl(data.logo_url ?? null);
      }
    };

    fetchCompany();
  }, [companyId]);

  useEffect(() => {
    const loadCompliance = async () => {
      if (!companyId || role !== "owner") return;
      setCompLoading(true);
      try {
        const data = await getComplianceSettings(companyId);
        setMaxWeekHours(data?.max_week_hours != null ? String(data.max_week_hours) : "");
        setMaxMonthHours(data?.max_month_hours != null ? String(data.max_month_hours) : "");
        setMinBetweenShifts(data?.min_hours_between_shifts != null ? String(data.min_hours_between_shifts) : "");
        setAllowedStart(data?.allowed_checkin_start ? data.allowed_checkin_start.slice(0, 5) : "");
        setAllowedEnd(data?.allowed_checkin_end ? data.allowed_checkin_end.slice(0, 5) : "");
        setAllowOutsideSchedule(data?.allow_outside_schedule ?? true);
      } catch (err) {
        console.error("Compliance load error", err);
        toast.error("No pudimos cargar los ajustes legales");
      } finally {
        setCompLoading(false);
      }
    };
    loadCompliance();
  }, [companyId, role]);

  useEffect(() => {
    if (!companyId || role !== "owner") return;
    const loadDayRules = async () => {
      setDayLoading(true);
      try {
        const data = await getCompanyDayRules(companyId);
        if (data) {
          setAllowSunday(Boolean(data.allow_sunday_clock));
          setHolidayPolicy(data.holiday_clock_policy);
          setSpecialPolicy(data.special_day_policy);
        } else {
          setAllowSunday(false);
          setHolidayPolicy("block");
          setSpecialPolicy("restrict");
        }
      } catch (err) {
        console.error("Day rules load error", err);
        toast.error("No pudimos cargar las reglas por día");
      } finally {
        setDayLoading(false);
      }
    };

    const loadWorkersAndRules = async () => {
      try {
        const { data, error } = await supabase
          .from("memberships")
          .select("user_id, role, profiles(full_name, email)")
          .eq("company_id", companyId);
        if (error) throw error;
        const list =
          (data || [])
            .filter((row: any) => row.role === "worker")
            .map((row: any) => ({
              user_id: row.user_id,
              role: row.role,
              full_name: row.profiles?.full_name || "Sin nombre",
              email: row.profiles?.email || "Sin email",
            })) ?? [];
        setWorkerList(list);
      } catch (err) {
        console.error("Workers load error", err);
      }

      try {
        const rules = await getWorkerDayRules(companyId);
        const map: Record<string, WorkerDayRules> = {};
        rules.forEach((r) => (map[r.user_id] = r));
        setWorkerRules(map);
      } catch (err) {
        console.error("Worker day rules load error", err);
      }
    };

    loadDayRules();
    loadWorkersAndRules();
  }, [companyId, role]);

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

      payload.entry_early_minutes = entryEarly;
      payload.entry_late_minutes = entryLate;
      payload.exit_early_minutes = exitEarly;
      payload.exit_late_minutes = exitLate;

      const { error } = await supabase.from("companies").update(payload).eq("id", companyId);

      if (error) throw error;
      
      // Determinar qué se guardó para mostrar mensaje apropiado
      const hasLocation = hqLat !== null && hqLng !== null;
      const hasMaxHours = normalized !== "";
      const hasClockRules = true; // Siempre se guardan las reglas de fichaje
      
      if (hasLocation || hasMaxHours || hasClockRules) {
        toast.success("Configuración guardada correctamente");
      } else {
        toast.success("Configuración guardada");
      }
    } catch (err) {
      console.error(err);
      toast.error("No pudimos guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const updateKeepSessions = async (value: boolean) => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ keep_sessions_open: value, keep_sessions_days: keepSessionsDays })
        .eq("id", companyId);
      if (error) throw error;
      setKeepSessionsOpen(value);
      toast.success(
        value
          ? "Sesiones mantenidas activadas (máximo 5 días)."
          : "Sesiones mantenidas desactivadas."
      );
    } catch (error) {
      console.error("Error actualizando sesiones mantenidas", error);
      toast.error("No pudimos actualizar esta opción");
    } finally {
      setSaving(false);
    }
  };

  const handleKeepSessionsToggle = (checked: boolean) => {
    if (checked) {
      pendingKeepSessionsValue.current = true;
      setShowKeepSessionsModal(true);
    } else {
      updateKeepSessions(false);
    }
  };

  const canEdit = role === "owner" || role === "admin";

  const handleSaveCompliance = async () => {
    if (!companyId) return;
    setCompSaving(true);
    try {
      const normalizeNumber = (v: string) => {
        const t = v.trim();
        if (!t) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      };
      await updateComplianceSettings(companyId, {
        max_week_hours: normalizeNumber(maxWeekHours),
        max_month_hours: normalizeNumber(maxMonthHours),
        min_hours_between_shifts: normalizeNumber(minBetweenShifts),
        allowed_checkin_start: allowedStart ? `${allowedStart}:00` : null,
        allowed_checkin_end: allowedEnd ? `${allowedEnd}:00` : null,
        allow_outside_schedule: allowOutsideSchedule,
      });
      toast.success("Ajustes legales guardados");
    } catch (err) {
      console.error("Compliance save error", err);
      toast.error("No pudimos guardar los ajustes legales");
    } finally {
      setCompSaving(false);
    }
  };

  const handleSaveDayRules = async () => {
    if (!companyId) return;
    setDaySaving(true);
    try {
      await upsertCompanyDayRules(companyId, {
        allow_sunday_clock: allowSunday,
        holiday_clock_policy: holidayPolicy,
        special_day_policy: specialPolicy,
      });
      toast.success("Reglas por tipo de día guardadas");
    } catch (err) {
      console.error("Day rules save error", err);
      toast.error("No pudimos guardar las reglas por día");
    } finally {
      setDaySaving(false);
    }
  };

  const openWorkerDialog = (worker: { user_id: string; full_name: string; email: string }) => {
    setSelectedWorker(worker);
    const current = workerRules[worker.user_id];
    setWorkerAllowSunday(
      typeof current?.allow_sunday_clock === "boolean" ? current.allow_sunday_clock : "inherit"
    );
    setWorkerHoliday(current?.holiday_clock_policy ?? "inherit");
    setWorkerSpecial(current?.special_day_policy ?? "inherit");
    setWorkerDialogOpen(true);
  };

  const handleSaveWorkerRule = async () => {
    if (!companyId || !selectedWorker) return;
    setWorkerSaving(true);
    try {
      const saved = await upsertWorkerDayRule(companyId, selectedWorker.user_id, {
        allow_sunday_clock: workerAllowSunday === "inherit" ? null : Boolean(workerAllowSunday),
        holiday_clock_policy: workerHoliday === "inherit" ? null : workerHoliday,
        special_day_policy: workerSpecial === "inherit" ? null : workerSpecial,
      });
      setWorkerRules((prev) => ({ ...prev, [selectedWorker.user_id]: saved }));
      toast.success("Override guardado");
      setWorkerDialogOpen(false);
    } catch (err) {
      console.error("Worker rule save error", err);
      toast.error("No pudimos guardar el override");
    } finally {
      setWorkerSaving(false);
    }
  };

  const filteredWorkers = workerList.filter((w) => {
    const term = workerSearch.toLowerCase();
    if (!term) return true;
    return w.full_name.toLowerCase().includes(term) || w.email.toLowerCase().includes(term);
  });

  return (
    <>
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
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Mantener sesión de trabajadores hasta 5 días</h2>
                  <p className="text-sm text-muted-foreground">
                    Permite que sus sesiones sigan iniciadas un máximo de 5 días desde el último login.
                  </p>
                </div>
                <Switch
                  checked={keepSessionsOpen}
                  onCheckedChange={handleKeepSessionsToggle}
                  disabled={!canEdit || saving}
                />
              </div>
              {!canEdit && (
                <p className="text-xs text-muted-foreground mt-2">Solo los owners/admin pueden modificar esta opción.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-sm">
              <Timer className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-lg font-semibold">Reglas de fichaje</h2>
              <p className="text-sm text-muted-foreground">
                Define cuántos minutos antes o después de la hora programada pueden fichar tus trabajadores. Si intentan fichar fuera de estos márgenes, verán un mensaje de error.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-early">Entrada: minutos ANTES</Label>
              <Input
                id="entry-early"
                type="number"
                min={0}
                value={entryEarly}
                onChange={(e) => setEntryEarly(Math.max(0, Number(e.target.value) || 0))}
                placeholder="10"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Minutos antes de la hora de entrada programada
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-late">Entrada: minutos DESPUÉS</Label>
              <Input
                id="entry-late"
                type="number"
                min={0}
                value={entryLate}
                onChange={(e) => setEntryLate(Math.max(0, Number(e.target.value) || 0))}
                placeholder="15"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Minutos después de la hora de entrada programada
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit-early">Salida: minutos ANTES</Label>
              <Input
                id="exit-early"
                type="number"
                min={0}
                value={exitEarly}
                onChange={(e) => setExitEarly(Math.max(0, Number(e.target.value) || 0))}
                placeholder="10"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Minutos antes de la hora de salida programada
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit-late">Salida: minutos DESPUÉS</Label>
              <Input
                id="exit-late"
                type="number"
                min={0}
                value={exitLate}
                onChange={(e) => setExitLate(Math.max(0, Number(e.target.value) || 0))}
                placeholder="15"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Minutos después de la hora de salida programada
              </p>
            </div>
          </div>
          {!canEdit && (
            <p className="text-xs text-muted-foreground">Solo los owners/admin pueden modificar estas reglas.</p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!canEdit || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar reglas de fichaje
            </Button>
          </div>
        </Card>

        {role === "owner" && (
          <Card className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-lg font-semibold">Owner Compliance Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Define los parámetros legales que aplican a todos los trabajadores de la empresa.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Límite de horas semanales</Label>
                <Input
                  type="number"
                  min={0}
                  value={maxWeekHours}
                  onChange={(e) => setMaxWeekHours(e.target.value)}
                  disabled={compLoading || compSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Límite de horas mensuales</Label>
                <Input
                  type="number"
                  min={0}
                  value={maxMonthHours}
                  onChange={(e) => setMaxMonthHours(e.target.value)}
                  disabled={compLoading || compSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Tiempo mínimo entre turnos (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  value={minBetweenShifts}
                  onChange={(e) => setMinBetweenShifts(e.target.value)}
                  disabled={compLoading || compSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora mínima de fichaje</Label>
                <p className="text-xs text-muted-foreground">
                  Déjalo vacío para permitir fichar a cualquier hora. Si lo rellenas, bloquea fichajes fuera de esa franja.
                </p>
                <Input
                  type="time"
                  value={allowedStart}
                  onChange={(e) => setAllowedStart(e.target.value)}
                  disabled={compLoading || compSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora máxima de fichaje</Label>
                <p className="text-xs text-muted-foreground">
                  Junto con la hora mínima define la ventana diaria permitida. En modo “off” (campo vacío) no se aplican restricciones.
                </p>
                <Input
                  type="time"
                  value={allowedEnd}
                  onChange={(e) => setAllowedEnd(e.target.value)}
                  disabled={compLoading || compSaving}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label>Permitir fichar fuera de horario</Label>
                <p className="text-sm text-muted-foreground">
                  Si está activo, los trabajadores pueden fichar aunque estén fuera de la franja programada o ventana legal configurada.
                </p>
              </div>
              <Switch
                checked={allowOutsideSchedule}
                onCheckedChange={setAllowOutsideSchedule}
                disabled={compLoading || compSaving}
                aria-label="Permitir fichar fuera de horario"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveCompliance} disabled={compLoading || compSaving}>
                {compSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar cambios
              </Button>
            </div>
          </Card>
        )}

        {role === "owner" && (
          <Card className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-lg font-semibold">Reglas por tipo de día</h2>
                <p className="text-sm text-muted-foreground">
                  Define si se puede fichar domingos, festivos o días especiales. Los overrides individuales prevalecen.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label>Fichar domingos</Label>
                <p className="text-sm text-muted-foreground">Activa para permitir fichajes en domingo.</p>
              </div>
              <Switch
                checked={allowSunday}
                onCheckedChange={setAllowSunday}
                disabled={dayLoading || daySaving}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Festivos</Label>
                <Select
                  value={holidayPolicy}
                  onValueChange={(v: HolidayPolicy) => setHolidayPolicy(v)}
                  disabled={dayLoading || daySaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona política" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Permitido</SelectItem>
                    <SelectItem value="require_reason">Permitido con motivo</SelectItem>
                    <SelectItem value="block">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">“Permitido con motivo” obliga a añadir nota en el fichaje.</p>
              </div>
              <div className="space-y-2">
                <Label>Días especiales</Label>
                <Select
                  value={specialPolicy}
                  onValueChange={(v: SpecialDayPolicy) => setSpecialPolicy(v)}
                  disabled={dayLoading || daySaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona política" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Permitido</SelectItem>
                    <SelectItem value="restrict">Modo restrictivo (bloquea)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Usa días especiales para cierres/eventos; “restrict” bloquea fichar.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveDayRules} disabled={daySaving}>
                {daySaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar reglas
              </Button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Buscar trabajador por nombre o email"
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  className="max-w-md"
                />
                {dayLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="space-y-2">
                {filteredWorkers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay trabajadores para mostrar.</p>
                )}
                {filteredWorkers.map((w) => {
                  const override = workerRules[w.user_id];
                  const hasOverride =
                    override &&
                    (override.allow_sunday_clock !== null ||
                      override.holiday_clock_policy !== null ||
                      override.special_day_policy !== null);
                  return (
                    <div key={w.user_id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="font-medium">{w.full_name}</p>
                        <p className="text-sm text-muted-foreground">{w.email}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={hasOverride ? "default" : "outline"}>
                            {hasOverride ? "Override activo" : "Heredando regla global"}
                          </Badge>
                          {hasOverride && override && (
                            <span className="text-xs text-muted-foreground">
                              Domingos: {override.allow_sunday_clock === null ? "hereda" : override.allow_sunday_clock ? "permitido" : "bloqueado"} · Festivos: {override.holiday_clock_policy || "hereda"} · Especiales: {override.special_day_policy || "hereda"}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => openWorkerDialog(w)}>
                        Configurar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

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
      <Dialog open={workerDialogOpen} onOpenChange={setWorkerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar reglas para {selectedWorker?.full_name || "trabajador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Domingos</Label>
              <Select
                value={String(workerAllowSunday)}
                onValueChange={(v) => setWorkerAllowSunday(v === "inherit" ? "inherit" : v === "true")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Heredar regla global</SelectItem>
                  <SelectItem value="true">Permitir</SelectItem>
                  <SelectItem value="false">Bloquear</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Festivos</Label>
              <Select
                value={workerHoliday || "inherit"}
                onValueChange={(v) => setWorkerHoliday(v as "inherit" | HolidayPolicy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Heredar regla global</SelectItem>
                  <SelectItem value="allow">Permitido</SelectItem>
                  <SelectItem value="require_reason">Permitido con motivo</SelectItem>
                  <SelectItem value="block">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Días especiales</Label>
              <Select
                value={workerSpecial || "inherit"}
                onValueChange={(v) => setWorkerSpecial(v as "inherit" | SpecialDayPolicy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Heredar regla global</SelectItem>
                  <SelectItem value="allow">Permitido</SelectItem>
                  <SelectItem value="restrict">Modo restrictivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setWorkerDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveWorkerRule} disabled={workerSaving}>
              {workerSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showKeepSessionsModal}
        onOpenChange={(open) => {
          setShowKeepSessionsModal(open);
          if (!open) pendingKeepSessionsValue.current = false;
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Activar sesiones mantenidas</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                Si activas esta opción, los trabajadores de tu empresa podrán mantener su sesión iniciada hasta 5 días seguidos sin volver a introducir su código.
              </p>
              <ul className="list-disc pl-4 text-sm space-y-1">
                <li>En dispositivos compartidos puede haber confusiones y fichar con la sesión de otra persona.</li>
                <li>Si se pierde un móvil o alguien deja la empresa, cierra sus sesiones desde el panel.</li>
                <li>Opción pensada para móviles personales, no para tablets compartidas tipo kiosko.</li>
              </ul>
              <p className="text-sm">
                Al continuar, aceptas que eres responsable del uso de esta opción en tu empresa.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowKeepSessionsModal(false);
                pendingKeepSessionsValue.current = false;
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setShowKeepSessionsModal(false);
                if (pendingKeepSessionsValue.current) {
                  updateKeepSessions(true);
                  pendingKeepSessionsValue.current = false;
                }
              }}
            >
              Entiendo y quiero activarlo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompanySettings;
