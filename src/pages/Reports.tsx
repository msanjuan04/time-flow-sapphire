import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  Clock,
  Users,
  ArrowLeft,
  MapPin,
  CalendarClock,
  ListChecks,
  AlertCircle,
  Loader2,
  Save,
  Timer,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { exportCSV } from "@/lib/exports";
import html2pdf from "html2pdf.js";
import OwnerIndividualReports from "@/components/OwnerIndividualReports";
import { Checkbox } from "@/components/ui/checkbox";

interface EmployeeStats {
  user_id: string;
  full_name: string;
  email: string;
  total_hours: number;
  total_days: number;
  avg_delay: number;
  correct_checks: number;
  incidents: number;
  punctuality_score: number;
  company_id: string;
}

interface Center {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

interface ClockInLocation {
  id?: string;
  user_id: string;
  event_time: string;
  event_type: string;
  latitude?: number;
  longitude?: number;
  profiles?: {
    full_name: string | null;
    email: string | null;
    center_id?: string | null;
  } | null;
}

interface SessionLike {
  id?: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_pause_duration?: number;
  is_corrected?: boolean;
  corrected_by?: string | null;
  correction_reason?: string | null;
  review_status?: string | null;
  profiles?: {
    id?: string;
    full_name: string | null;
    email: string | null;
    center_id: string | null;
  };
}

interface EmployeesReportData {
  startDate: string;
  endDate: string;
  employees: EmployeeStats[];
  sessions: SessionLike[];
  centers: Center[];
  filters: {
    center: string;
    employee: string;
  };
  clockEvents?: ClockInLocation[];
  geoAddressMap?: Record<string, string>;
  selectedSections?: string[];
}

const buildSessionsFromEvents = (events: ClockInLocation[]) => {
  if (!events || events.length === 0) return [];

  const sessions: SessionLike[] = [];
  const grouped = new Map<string, ClockInLocation[]>();

  events.forEach((event) => {
    if (!grouped.has(event.user_id)) grouped.set(event.user_id, []);
    grouped.get(event.user_id)!.push(event);
  });

  grouped.forEach((userEvents) => {
    userEvents.sort(
      (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
    );

    let current: {
      clockIn?: Date;
      pauseStart?: Date | null;
      pauseMs: number;
      profile: SessionLike["profiles"];
    } | null = null;

    userEvents.forEach((event) => {
      if (event.event_type === "clock_in") {
        if (current?.clockIn) {
          sessions.push({
            user_id: event.user_id,
            clock_in_time: current.clockIn.toISOString(),
            clock_out_time: null,
            total_pause_duration: current.pauseMs,
            profiles: current.profile,
          });
        }
        current = {
          clockIn: new Date(event.event_time),
          pauseStart: null,
          pauseMs: 0,
          profile: {
            full_name: event.profiles?.full_name ?? null,
            email: event.profiles?.email ?? null,
            center_id: event.profiles?.center_id ?? null,
            id: event.user_id,
          },
        };
        return;
      }

      if (!current || !current.clockIn) return;

      if (event.event_type === "pause_start") {
        current.pauseStart = new Date(event.event_time);
        return;
      }

      if (event.event_type === "pause_end" && current.pauseStart) {
        current.pauseMs += new Date(event.event_time).getTime() - current.pauseStart.getTime();
        current.pauseStart = null;
        return;
      }

      if (event.event_type === "clock_out") {
        const clockOut = new Date(event.event_time);
        let pauseMs = current.pauseMs;

        if (current.pauseStart) {
          pauseMs += clockOut.getTime() - current.pauseStart.getTime();
        }

        sessions.push({
          user_id: event.user_id,
          clock_in_time: current.clockIn.toISOString(),
          clock_out_time: clockOut.toISOString(),
          total_pause_duration: pauseMs,
          profiles: current.profile,
        });

        current = null;
      }
    });

    if (current?.clockIn) {
      sessions.push({
        user_id: current.profile?.id || userEvents[0].user_id,
        clock_in_time: current.clockIn.toISOString(),
        clock_out_time: null,
        total_pause_duration: current.pauseMs,
        profiles: current.profile,
      });
    }
  });

  return sessions;
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444"];
const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEKDAY_FILTERS = [
  { value: "all", label: "Todos los días" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];
const PDF_SECTION_OPTIONS: never[] = [];
const getEventColor = (type: string) => {
  switch (type) {
    case "clock_in":
      return "#10b981";
    case "clock_out":
      return "#ef4444";
    case "pause_start":
      return "#f59e0b";
    case "pause_end":
      return "#f97316";
    default:
      return "#3b82f6";
  }
};

const escapeHtml = (value: string) => {
  if (!value) return "";
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatReportDate = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatCoordinate = (latitude: number, longitude: number) => {
  const lat = Number.isFinite(latitude) ? latitude.toFixed(4) : "-";
  const lon = Number.isFinite(longitude) ? longitude.toFixed(4) : "-";
  return `${lat}, ${lon}`;
};

const GEO_KEY_PRECISION = 4;

const makeGeoKey = (latitude: number, longitude: number) => {
  return `${latitude.toFixed(GEO_KEY_PRECISION)},${longitude.toFixed(GEO_KEY_PRECISION)}`;
};

const parseGeoKey = (key: string) => {
  const [latStr, lngStr] = key.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  return { lat, lng };
};

const labelFromGeoKey = (key: string, geoAddressMap?: Record<string, string>) => {
  if (geoAddressMap && geoAddressMap[key]) {
    return geoAddressMap[key];
  }
  const { lat, lng } = parseGeoKey(key);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return key;
  }
  return formatCoordinate(lat, lng);
};

const buildAddressLabel = (
  address:
    | Record<string, string | null | undefined>
    | null
    | undefined,
  fallback: string
) => {
  if (!address) return fallback;
  const streetSource =
    address.road ||
    address.street ||
    address.residential ||
    address.path ||
    address.pedestrian;
  const street = [streetSource, address.house_number]
    .filter(Boolean)
    .join(" ")
    .trim();
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    address.neighbourhood ||
    address.municipality ||
    address.county;
  const region = address.state || address.province || address.region;
  const parts: string[] = [];
  if (street) parts.push(street);
  if (locality) parts.push(locality);
  const label = parts.join(", ");
  if (label && region) {
    return `${label} (${region})`;
  }
  return label || fallback;
};

const buildEmployeesReportHtml = (reportData: EmployeesReportData) => {
  const {
    startDate,
    endDate,
    employees,
    sessions,
    centers,
    filters,
    clockEvents = [],
    geoAddressMap = {},
    selectedSections = ["context", "summary", "table"],
  } = reportData;

  const wants = (section: string) => selectedSections.includes(section);
  const includeContext = wants("context");
  const includeSummary = wants("summary");
  const includeMap = wants("map");
  const includeCharts = wants("charts");
  // Mantener siempre la tabla como parte del informe para garantizar la legibilidad.
  const includeTable = true;

  const docTitle = "Informe de fichajes de trabajadores";
  const dateRangeLabel = `${formatReportDate(startDate)} – ${formatReportDate(endDate)}`;
  const totalEmployees = employees.length;
  const totalHours = employees.reduce((sum, emp) => sum + emp.total_hours, 0);
  const totalIncidents = employees.reduce((sum, emp) => sum + emp.incidents, 0);
  const avgPunctuality =
    totalEmployees > 0
      ? employees.reduce((sum, emp) => sum + emp.punctuality_score, 0) / totalEmployees
      : 0;

  const formatHours = (hours: number) =>
    hours.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const centerMap = new Map<string, string>();
  centers.forEach((center) => {
    centerMap.set(center.id, center.name);
  });

  const resolveCenterLabel = (centerId?: string | null) => {
    if (!centerId) return "Sin centro registrado";
    return centerMap.get(centerId) || "Centro sin nombre";
  };

  type SessionSummary = {
    count: number;
    locationCounts: Record<string, number>;
  };

  const sessionSummary = new Map<string, SessionSummary>();
  const globalLocations = new Map<string, number>();
  const geoEvents = (clockEvents || []).filter(
    (event) => typeof event.latitude === "number" && typeof event.longitude === "number"
  );
  const geoLocationTotals = new Map<string, number>();
  const employeeGeoLocations = new Map<string, Map<string, number>>();

  sessions.forEach((session) => {
    const location = resolveCenterLabel(session.profiles?.center_id ?? null);
    globalLocations.set(location, (globalLocations.get(location) ?? 0) + 1);
    const summary = sessionSummary.get(session.user_id) ?? {
      count: 0,
      locationCounts: {},
    };
    summary.count += 1;
    summary.locationCounts[location] = (summary.locationCounts[location] ?? 0) + 1;
    sessionSummary.set(session.user_id, summary);
  });

  geoEvents.forEach((event) => {
    const latitude = Number(event.latitude);
    const longitude = Number(event.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const geoKey = makeGeoKey(latitude, longitude);
    geoLocationTotals.set(geoKey, (geoLocationTotals.get(geoKey) ?? 0) + 1);
    const userMap = employeeGeoLocations.get(event.user_id) ?? new Map<string, number>();
    userMap.set(geoKey, (userMap.get(geoKey) ?? 0) + 1);
    employeeGeoLocations.set(event.user_id, userMap);
  });

  const sortedEmployees = [...employees].sort((a, b) => b.total_hours - a.total_hours);

  const employeeRows =
    sortedEmployees
      .map((stat) => {
        const summary = sessionSummary.get(stat.user_id);
        const locationEntries = summary
          ? Object.entries(summary.locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
          : [];
        const geoEntry = employeeGeoLocations.get(stat.user_id);
        const geoEntriesRaw = geoEntry
          ? Array.from(geoEntry.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
          : [];
        const geoEntries = geoEntriesRaw.map(([key, count]) => ({
          key,
          count,
          label: labelFromGeoKey(key, geoAddressMap),
        }));

        const centerSection = locationEntries.length
          ? `<div class="location-group">
              <p class="location-label">Centros</p>
              <ul class="location-list">
                ${locationEntries
                  .map(
                    ([location, count]) =>
                      `<li><span>${escapeHtml(location)}</span><strong>${count} fichajes</strong></li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : "";

        const geoSection = geoEntries.length
          ? `<div class="location-group">
              <p class="location-label">Coordenadas</p>
              <ul class="location-list">
                ${geoEntries
                  .map(
                    ({ key, label, count }) =>
                      `<li><span>${escapeHtml(label)}</span><strong>${count} fichajes</strong></li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : "";

        const locationsHtml =
          centerSection || geoSection
            ? `${centerSection}${geoSection}`
            : `<p class="muted">Sin ubicaciones registradas</p>`;

        const locationDetails = locationEntries.length
          ? locationEntries.map(([location, count]) => `${count} en ${location}`).join(", ")
          : "";
        const geoDetails = geoEntries.length
          ? geoEntries.map(({ label, count }) => `${count} en ${label}`).join(", ")
          : "";
        const detailParts: string[] = [];
        if (summary) {
          detailParts.push(
            `${summary.count} fichajes – ${locationDetails || "ubicaciones sin registrar"}`
          );
        }
        if (geoDetails) {
          detailParts.push(`Geo: ${geoDetails}`);
        }
        const detailsText = detailParts.length ? detailParts.join(" | ") : "Sin fichajes detallados";

        const workerName = stat.full_name || stat.email || "Empleado";
        return `<tr>
          <td>${escapeHtml(workerName)}</td>
          <td>${stat.email ? escapeHtml(stat.email) : "—"}</td>
          <td>${formatHours(stat.total_hours)} h</td>
          <td>${locationsHtml}</td>
          <td>${escapeHtml(detailsText)}</td>
        </tr>`;
      })
      .join("") ||
    `<tr><td colspan="5" class="muted">No hay datos disponibles para este período.</td></tr>`;

  const summarySection = includeSummary
    ? `<section class="report-section">
        <h2>Resumen general</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <p class="summary-label">Trabajadores incluidos</p>
            <p class="summary-value">${totalEmployees}</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">Horas totales registradas</p>
            <p class="summary-value">${formatHours(totalHours)} h</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">Incidencias registradas</p>
            <p class="summary-value">${totalIncidents}</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">Puntualidad promedio</p>
            <p class="summary-value">${avgPunctuality.toFixed(1)}%</p>
          </div>
        </div>
      </section>`
    : "";

  const contextSection = includeContext
    ? `<section class="report-section">
        <h2>Contexto del informe</h2>
        <div class="context-grid">
          <p><strong>Período:</strong> ${escapeHtml(dateRangeLabel)}</p>
          <p><strong>Centro:</strong> ${escapeHtml(filters.center)}</p>
          <p><strong>Empleado:</strong> ${
            filters.employee ? escapeHtml(filters.employee) : "Todos los empleados"
          }</p>
        </div>
      </section>`
    : "";

  const topLocations = Array.from(globalLocations.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topGeoLocations = Array.from(geoLocationTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({
      key,
      count,
      label: labelFromGeoKey(key, geoAddressMap),
    }));

  const mapSection = includeMap
    ? `<section class="report-section">
        <h2>Ubicaciones principales</h2>
        <div class="locations-grid">
          <div>
            <h3>Centros</h3>
            ${
              topLocations.length
                ? `<ul class="locations-list">
                ${topLocations
                  .map(
                    ([location, count]) =>
                      `<li><span>${escapeHtml(location)}</span><strong>${count} fichajes</strong></li>`
                  )
                  .join("")}
              </ul>`
                : `<p class="muted">No hay ubicaciones registradas en el período seleccionado.</p>`
            }
          </div>
          <div>
            <h3>Coordenadas geolocalizadas</h3>
            ${
              topGeoLocations.length
                ? `<ul class="locations-list">
                ${topGeoLocations
                  .map(
                    ({ key, label, count }) =>
                      `<li><span>${escapeHtml(label)}</span><strong>${count} fichajes</strong></li>`
                  )
                  .join("")}
              </ul>`
                : `<p class="muted">No hay fichajes con ubicación geográfica.</p>`
            }
          </div>
        </div>
      </section>`
    : "";

  const topByHours = sortedEmployees.slice(0, 5);
  const topByPunctuality = [...employees]
    .sort((a, b) => b.punctuality_score - a.punctuality_score)
    .slice(0, 5);

  const chartsSection = includeCharts
    ? `<section class="report-section">
        <h2>Ranking de rendimiento</h2>
        <div class="rankings-grid">
          <div>
            <h3>Más horas registradas</h3>
            <ol>
              ${
                topByHours.length
                  ? topByHours
                      .map(
                        (stat) =>
                          `<li><span>${escapeHtml(stat.full_name || stat.email || "Empleado")}</span><strong>${formatHours(
                            stat.total_hours
                          )} h</strong></li>`
                      )
                      .join("")
                  : "<li>Sin datos disponibles</li>"
              }
            </ol>
          </div>
          <div>
            <h3>Mejor puntualidad</h3>
            <ol>
              ${
                topByPunctuality.length
                  ? topByPunctuality
                      .map(
                        (stat) =>
                          `<li><span>${escapeHtml(stat.full_name || stat.email || "Empleado")}</span><strong>${stat.punctuality_score.toFixed(
                            1
                          )}%</strong></li>`
                      )
                      .join("")
                  : "<li>Sin datos disponibles</li>"
              }
            </ol>
          </div>
        </div>
      </section>`
    : "";

  const tableSection = includeTable
    ? `<section class="report-section">
        <h2>Detalle por trabajador</h2>
        <table>
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Email</th>
              <th>Horas totales</th>
              <th>Ubicaciones</th>
              <th>Detalles</th>
            </tr>
          </thead>
          <tbody>
            ${employeeRows}
          </tbody>
        </table>
      </section>`
    : "";

  return `<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(docTitle)}</title>
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          margin: 0;
          padding: 0;
          background: #f8fafc;
          color: #0f172a;
        }
        .report-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 32px;
          background: white;
        }
        header {
          text-align: center;
          margin-bottom: 32px;
        }
        h1 {
          margin: 0;
          font-size: 28px;
        }
        h2 {
          font-size: 18px;
          margin-bottom: 12px;
        }
        h3 {
          font-size: 15px;
          margin-bottom: 8px;
        }
        .report-date {
          margin-top: 8px;
          color: #475569;
        }
        .report-section {
          margin-bottom: 28px;
        }
        .summary-grid,
        .rankings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }
        .locations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }
        .summary-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          background: #f8fafc;
        }
        .location-group {
          margin-bottom: 10px;
        }
        .location-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 4px;
        }
        .location-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .location-list li {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          border-bottom: 1px dashed #e2e8f0;
          padding: 4px 0;
          gap: 12px;
        }
        .location-list li strong {
          color: #0ea5e9;
          font-weight: 600;
        }
        .summary-label {
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 6px;
        }
        .summary-value {
          font-size: 20px;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        th {
          text-align: left;
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #475569;
          border-bottom: 1px solid #cbd5f5;
          padding: 10px 8px;
          background: #f1f5f9;
        }
        td {
          padding: 12px 8px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
        }
        .muted {
          color: #94a3b8;
          text-align: center;
        }
        .locations-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .locations-list li {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
        }
        .locations-list li span {
          color: #0f172a;
        }
        .locations-list li strong {
          color: #0ea5e9;
        }
        .rankings-grid ol {
          padding-left: 18px;
          margin: 0;
        }
        .rankings-grid li {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
        }
        .context-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px;
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <header>
          <h1>${escapeHtml(docTitle)}</h1>
          <p class="report-date">${escapeHtml(dateRangeLabel)}</p>
        </header>
        ${contextSection}
        ${summarySection}
        ${mapSection}
        ${chartsSection}
        ${tableSection}
      </div>
    </body>
  </html>`;
};
const Reports = () => {
  const { user } = useAuth();
  const { companyId, membership, loading: membershipLoading, role } = useMembership();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessionsRaw, setSessionsRaw] = useState<SessionLike[]>([]);
  const [geoAddressCache, setGeoAddressCache] = useState<Record<string, string>>({});
  const GEO_LOOKUP_ENABLED = false;
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [adjusting, setAdjusting] = useState<Record<string, boolean>>({});
  const [adjustValues, setAdjustValues] = useState<Record<string, { clock_out_time: string; reason: string }>>({});
  const [scheduleReminderDismissed, setScheduleReminderDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("scheduleReminderDismissed") === "1";
    } catch {
      return false;
    }
  });
  const showScheduleReminder = !scheduleReminderDismissed && !loading && employeeStats.length === 0;
  const [selectedPdfSections, setSelectedPdfSections] = useState<string[]>([]);
  // Filtros de fechas: por defecto mes actual completo
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return first.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return last.toISOString().slice(0, 10);
  });
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [monthlyMonth, setMonthlyMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyCenter, setMonthlyCenter] = useState<string>("all");
  const [selectedCenter, setSelectedCenter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [onlyPendingReview, setOnlyPendingReview] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.Marker[]>([]);
  const pendingGeoLookups = useRef<Set<string>>(new Set());
  const geoLookupWarned = useRef(false);
  const [mapEvents, setMapEvents] = useState<ClockInLocation[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState<string>("all");
  const filteredMapEvents = useMemo(() => {
    if (selectedWeekday === "all") {
      return mapEvents;
    }
    const weekdayNumber = Number(selectedWeekday);
    return mapEvents.filter((event) => {
      const eventDay = new Date(event.event_time).getDay();
      return eventDay === weekdayNumber;
    });
  }, [mapEvents, selectedWeekday]);
  const eventsWithCoords = useMemo(
    () =>
      filteredMapEvents.filter(
        (event) =>
          typeof event.latitude === "number" && typeof event.longitude === "number"
      ),
    [filteredMapEvents]
  );
  const topGeoLocations = useMemo(() => {
    const counts = new Map<
      string,
      { count: number; latitude: number; longitude: number }
    >();
    filteredMapEvents.forEach((event) => {
      if (typeof event.latitude !== "number" || typeof event.longitude !== "number") return;
      const key = makeGeoKey(event.latitude, event.longitude);
      if (!counts.has(key)) {
        counts.set(key, {
          count: 0,
          latitude: event.latitude,
          longitude: event.longitude,
        });
      }
      counts.get(key)!.count += 1;
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([key, value]) => ({
        key,
        count: value.count,
        label: geoAddressCache[key] ?? formatCoordinate(value.latitude, value.longitude),
      }));
  }, [filteredMapEvents, geoAddressCache]);

  const getLocationLabel = useCallback(
    (latitude?: number | null, longitude?: number | null) => {
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return "Ubicación no disponible";
      }
      const key = makeGeoKey(latitude, longitude);
      return geoAddressCache[key] || formatCoordinate(latitude, longitude);
    },
    [geoAddressCache]
  );

  useEffect(() => {
    if (!GEO_LOOKUP_ENABLED) return;
    if (typeof window === "undefined") return;

    const uniqueKeys = Array.from(
      new Set(
        filteredMapEvents
          .map((event) => {
            if (typeof event.latitude !== "number" || typeof event.longitude !== "number") {
              return null;
            }
            return makeGeoKey(event.latitude, event.longitude);
          })
          .filter((key): key is string => Boolean(key))
      )
    );

    const missingKeys = uniqueKeys.filter(
      (key) => !geoAddressCache[key] && !pendingGeoLookups.current.has(key)
    );
    if (missingKeys.length === 0) return;

    let cancelled = false;
    const batch = missingKeys.slice(0, 6);

    const fetchAddress = async (key: string) => {
      pendingGeoLookups.current.add(key);
      const coords = parseGeoKey(key);
      try {
        if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
          throw new Error("Invalid coordinates");
        }
        const params = new URLSearchParams({
          lat: coords.lat.toString(),
          lon: coords.lng.toString(),
          format: "json",
        });
        const response = await fetch(`https://geocode.maps.co/reverse?${params.toString()}`, {
          headers: {
            Accept: "application/json",
          },
        });
        if (!response.ok) {
          throw new Error(`Reverse geocoding failed ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;
        const fallback = data?.display_name || `Coordenadas ${formatCoordinate(coords.lat, coords.lng)}`;
        const label = buildAddressLabel(data?.address, fallback);
        setGeoAddressCache((prev) => ({
          ...prev,
          [key]: label || fallback,
        }));
      } catch (error) {
        if (cancelled) return;
        const fallback = `Coordenadas ${formatCoordinate(coords.lat, coords.lng)}`;
        setGeoAddressCache((prev) => ({
          ...prev,
          [key]: fallback,
        }));
        if (!geoLookupWarned.current) {
          geoLookupWarned.current = true;
        }
      } finally {
        pendingGeoLookups.current.delete(key);
      }
    };

    batch.forEach((key) => {
      fetchAddress(key);
    });

    return () => {
      cancelled = true;
    };
  }, [filteredMapEvents, geoAddressCache]);

  const dismissScheduleReminder = () => {
    setScheduleReminderDismissed(true);
    try {
      localStorage.setItem("scheduleReminderDismissed", "1");
    } catch {
      // ignore storage issues
    }
  };

  const pendingReviewSessions = sessionsRaw.filter(
    (s) => s.review_status === "exceeded_limit" || s.review_status === "pending_review"
  );
  const pendingReviewCount = pendingReviewSessions.length;

  const toDatetimeLocal = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  };

  const setAdjustValue = (id: string, field: "clock_out_time" | "reason", value: string) => {
    setAdjustValues((prev) => ({
      ...prev,
      [id]: { clock_out_time: prev[id]?.clock_out_time ?? "", reason: prev[id]?.reason ?? "", [field]: value },
    }));
  };

  const handleAdjustSession = async (session: SessionLike) => {
    if (!session.id) {
      toast.error("No se puede ajustar: falta el identificador de la sesión");
      return;
    }
    const values = adjustValues[session.id] || {
      clock_out_time: session.clock_out_time ? toDatetimeLocal(session.clock_out_time) : "",
      reason: "",
    };
    if (!values.clock_out_time) {
      toast.error("Indica la hora de salida corregida");
      return;
    }
    setAdjusting((prev) => ({ ...prev, [session.id!]: true }));
    try {
      const { error } = await supabase.functions.invoke("adjust-work-session", {
        body: {
          session_id: session.id,
          clock_out_time: new Date(values.clock_out_time).toISOString(),
          correction_reason: values.reason || undefined,
        },
      });
      if (error) throw error;
      toast.success("Fichada corregida");
      await fetchReportData();
    } catch (err) {
      console.error("Error ajustando sesión", err);
      const message =
        err && typeof err === "object" && "message" in (err as any) ? String((err as any).message) : "Error al corregir";
      toast.error(message);
    } finally {
      setAdjusting((prev) => ({ ...prev, [session.id!]: false }));
    }
  };

  const updatePdfSectionSelection = (sectionId: string, checked: boolean) => {
    setSelectedPdfSections((prev) => {
      if (!checked) {
        if (prev.length === 1 && prev[0] === sectionId) {
          toast.error("Selecciona al menos una sección para generar el PDF");
          return prev;
        }
        return prev.filter((id) => id !== sectionId);
      }
      if (prev.includes(sectionId)) return prev;
      return [...prev, sectionId];
    });
  };
  const uniqueEmployeesOnMap = useMemo(() => {
    return new Set(filteredMapEvents.map((event) => event.user_id)).size;
  }, [filteredMapEvents]);

  useEffect(() => {
    if (!membershipLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }
      if (!companyId) {
        toast.error("No tienes una empresa asignada");
        navigate("/");
        return;
      }
      fetchFiltersData();
    }
  }, [companyId, user, membershipLoading, navigate]);

  const fetchMapEvents = useCallback(async () => {
    if (!companyId) return;
    setMapLoading(true);
    try {
      let query = supabase
        .from("time_events")
        .select(`
          id,
          user_id,
          event_time,
          event_type,
          latitude,
          longitude
        `)
        .eq("company_id", companyId)
        .eq("event_type", "clock_in")
        .gte("event_time", `${startDate}T00:00:00`)
        .lte("event_time", `${endDate}T23:59:59`)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("event_time", { ascending: false });

      if (selectedEmployee !== "all") {
        query = query.eq("user_id", selectedEmployee);
      }

      const { data, error } = await query;
      if (error) throw error;

      const events = (data as ClockInLocation[]) || [];
      const userIds = Array.from(new Set(events.map((event) => event.user_id)));

      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        profilesMap = (profileRows || []).reduce(
          (acc, profile) => {
            acc[profile.id] = {
              full_name: profile.full_name,
              email: profile.email,
            };
            return acc;
          },
          {} as Record<string, { full_name: string | null; email: string | null }>
        );
      }

      setMapEvents(
        events.map((event) => ({
          ...event,
          profiles: profilesMap[event.user_id] ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching map data:", error);
      setMapEvents([]);
      toast.error("No pudimos cargar el mapa de fichajes");
    } finally {
      setMapLoading(false);
    }
  }, [companyId, endDate, selectedEmployee, startDate]);

  useEffect(() => {
    if (companyId) {
      fetchReportData();
    }
  }, [companyId, startDate, endDate, selectedCenter, selectedEmployee, onlyPendingReview]);

  useEffect(() => {
    if (companyId) {
      fetchMapEvents();
    }
  }, [companyId, fetchMapEvents]);

  useEffect(() => {
    if (leafletMapRef.current || !mapContainerRef.current) return;

    const mapInstance = L.map(mapContainerRef.current, {
      center: [40.4168, -3.7038],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(mapInstance);

    leafletMapRef.current = mapInstance;

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 0);

    return () => {
      mapInstance.remove();
      leafletMapRef.current = null;
      leafletMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const mapInstance = leafletMapRef.current;
    if (!mapInstance) return;

    leafletMarkersRef.current.forEach((marker) => marker.remove());
    leafletMarkersRef.current = [];

    if (eventsWithCoords.length === 0) return;

    const bounds = L.latLngBounds([]);

    eventsWithCoords.forEach((event) => {
      const icon = L.divIcon({
        className: "",
        html: `<span style="
          background:${getEventColor(event.event_type)};
          width:22px;
          height:22px;
          display:block;
          border:3px solid #ffffff;
          border-radius:50%;
          box-shadow:0 4px 10px rgba(0,0,0,0.25);
        "></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const leafletMarker = L.marker([event.latitude, event.longitude], { icon }).addTo(mapInstance);
      leafletMarker.bindPopup(
        `<strong>${event.profiles?.full_name || event.profiles?.email || "Empleado"}</strong><br/>
         ${new Date(event.event_time).toLocaleDateString("es-ES")} · ${new Date(event.event_time).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );

      leafletMarkersRef.current.push(leafletMarker);
      bounds.extend([event.latitude, event.longitude]);
    });

    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [eventsWithCoords]);

  const fetchFiltersData = async () => {
    // Fetch centers
    const { data: centersData } = await supabase
      .from("centers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    setCenters(centersData || []);

    // Fetch employees
    const { data: employeesData } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        memberships!inner(company_id)
      `)
      .eq("memberships.company_id", companyId)
      .order("full_name");

    setEmployees(employeesData || []);
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Build query for work sessions
      let query = supabase
        .from("work_sessions")
        .select(`
          id,
          user_id,
          clock_in_time,
          clock_out_time,
          total_work_duration,
          total_pause_duration,
          is_corrected,
          corrected_by,
          correction_reason,
          review_status,
          status,
          profiles!inner(id, full_name, email, center_id)
        `)
        .eq("company_id", companyId)
        .gte("clock_in_time", `${startDate}T00:00:00`)
        .lte("clock_in_time", `${endDate}T23:59:59`);

      if (selectedCenter !== "all") {
        query = query.eq("profiles.center_id", selectedCenter);
      }

      if (selectedEmployee !== "all") {
        query = query.eq("user_id", selectedEmployee);
      }

      if (onlyPendingReview) {
        query = query.or(
          "review_status.eq.exceeded_limit,review_status.eq.pending_review,review_status.is.null,status.eq.auto_closed"
        );
      }

      const { data: sessions } = await query;

      // Get time events for punctuality analysis (also used for fallback sessions)
      let eventsQuery = supabase
        .from("time_events")
        .select(`
          user_id,
          event_type,
          event_time,
          profiles!inner(id, full_name, email, center_id)
        `)
        .eq("company_id", companyId)
        .gte("event_time", `${startDate}T00:00:00`)
        .lte("event_time", `${endDate}T23:59:59`);

      if (selectedCenter !== "all") {
        eventsQuery = eventsQuery.eq("profiles.center_id", selectedCenter);
      }

      if (selectedEmployee !== "all") {
        eventsQuery = eventsQuery.eq("user_id", selectedEmployee);
      }

      const { data: events } = await eventsQuery;

      let sessionsData: SessionLike[] = (sessions as SessionLike[]) || [];

      // Si pedimos solo pendientes, no construimos sesiones desde eventos (no tienen review_status)
      if ((!sessionsData || sessionsData.length === 0) && events && events.length > 0 && !onlyPendingReview) {
        sessionsData = buildSessionsFromEvents(events as ClockInLocation[]);
      }

      if (onlyPendingReview) {
        const pendingStatuses = ["pending_review", "exceeded_limit"];
        sessionsData = sessionsData.filter(
          (s: any) =>
            pendingStatuses.includes(s.review_status ?? "") ||
            s.status === "auto_closed" ||
            (!s.review_status && s.status !== "closed")
        );
      }

      setSessionsRaw(sessionsData);

      // Get incidents
      let incidentsQuery = supabase
        .from("incidents")
        .select("user_id, status")
        .eq("company_id", companyId)
        .gte("incident_date", startDate)
        .lte("incident_date", endDate);

      if (selectedEmployee !== "all") {
        incidentsQuery = incidentsQuery.eq("user_id", selectedEmployee);
      }

      const { data: incidents } = await incidentsQuery;

      // Process data by user
      const userStatsMap = new Map<string, EmployeeStats>();

      sessionsData?.forEach((session) => {
        const userId = session.user_id;
        const profileInfo = session.profiles || {
          full_name: "Empleado",
          email: "",
          center_id: null,
        };
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            user_id: userId,
            full_name: profileInfo.full_name || profileInfo.email || "Empleado",
            email: profileInfo.email || "",
            total_hours: 0,
            total_days: 0,
            avg_delay: 0,
            correct_checks: 0,
            incidents: 0,
            punctuality_score: 100,
            company_id: companyId || "unknown",
          });
        }

        const stats = userStatsMap.get(userId)!;
        
        // Calculate hours
        if (session.clock_in_time) {
          const start = new Date(session.clock_in_time).getTime();
          const end = session.clock_out_time ? new Date(session.clock_out_time).getTime() : Date.now();
          const pauseMs = Number(session.total_pause_duration ?? 0);
          const duration = Math.max(0, end - start - (isNaN(pauseMs) ? 0 : pauseMs));
          stats.total_hours += duration / (1000 * 60 * 60);
          stats.total_days += 1;
        }
      });

      // Calculate punctuality (delay from 9:00 AM)
      events?.forEach((event: any) => {
        if (event.event_type === 'clock_in') {
          const stats = userStatsMap.get(event.user_id);
          if (stats) {
            const eventTime = new Date(event.event_time);
            const scheduledStart = new Date(eventTime);
            scheduledStart.setHours(9, 0, 0, 0);
            
            const delayMinutes = (eventTime.getTime() - scheduledStart.getTime()) / (1000 * 60);
            
            if (delayMinutes > 0) {
              stats.avg_delay = (stats.avg_delay + delayMinutes) / 2;
            }
            
            if (Math.abs(delayMinutes) <= 5) {
              stats.correct_checks += 1;
            }
          }
        }
      });

      // Add incidents
      incidents?.forEach((incident: any) => {
        const stats = userStatsMap.get(incident.user_id);
        if (stats) {
          stats.incidents += 1;
        }
      });

      // Calculate punctuality score
      userStatsMap.forEach((stats) => {
        const totalChecks = stats.total_days;
        if (totalChecks > 0) {
          const correctRate = (stats.correct_checks / totalChecks) * 100;
          const delayPenalty = Math.min(stats.avg_delay, 30); // Max 30 min penalty
          stats.punctuality_score = Math.max(0, correctRate - delayPenalty);
        }
      });

      const statsArray = Array.from(userStatsMap.values());
      statsArray.sort((a, b) => b.punctuality_score - a.punctuality_score);

      setEmployeeStats(statsArray);
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error("Error al cargar los datos del reporte");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Empleado",
      "Email",
      "Horas Totales",
      "Días Trabajados",
      "Retraso Promedio (min)",
      "Fichajes Correctos",
      "Incidencias",
      "Puntuación Puntualidad",
    ];
    const rows = employeeStats.map((stat) => [
      stat.full_name,
      stat.email,
      stat.total_hours.toFixed(2),
      stat.total_days,
      stat.avg_delay.toFixed(0),
      stat.correct_checks,
      stat.incidents,
      stat.punctuality_score.toFixed(1),
    ]);
    exportCSV(`reporte_${startDate}_${endDate}`, headers, rows);
    toast.success("Reporte exportado correctamente");
  };

  const getReportHtml = () => {
    const companyEmployees = companyId
      ? employeeStats.filter((stat) => stat.company_id === companyId)
      : employeeStats;
    if (companyEmployees.length === 0) {
      return null;
    }
    const centerLabel =
      selectedCenter === "all"
        ? "Todos los centros"
        : centers.find((center) => center.id === selectedCenter)?.name || "Centro no disponible";
    const selectedEmp =
      selectedEmployee === "all"
        ? null
        : employees.find((emp) => emp.id === selectedEmployee) || null;
    const employeeLabel =
      selectedEmployee === "all"
        ? "Todos los empleados"
        : selectedEmp?.full_name || selectedEmp?.email || "Empleado";

    return buildEmployeesReportHtml({
      startDate,
      endDate,
      employees: companyEmployees,
      sessions: sessionsRaw,
      centers,
      filters: {
        center: centerLabel,
        employee: employeeLabel,
      },
      clockEvents: filteredMapEvents,
      geoAddressMap: geoAddressCache,
      selectedSections: [],
    });
  };

  const handleDownloadPDF = async () => {
    const reportHtml = getReportHtml();
    if (!reportHtml) {
      toast.error("No hay datos disponibles para generar el informe");
      return;
    }

    const options = {
      margin: 10,
      filename: "informe-gtiq.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    try {
      await html2pdf().set(options).from(reportHtml).save();
      toast.success("Informe generado correctamente");
      setPreviewOpen(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("No pudimos generar el PDF");
    }
  };

  const handlePreviewPDF = () => {
    const reportHtml = getReportHtml();
    if (!reportHtml) {
      toast.error("No hay datos disponibles para la vista previa");
      return;
    }
    try {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(reportHtml, "text/html");
      const inlineStyles = Array.from(parsed.head.querySelectorAll("style"))
        .map((style) => style.outerHTML)
        .join("");
      const bodyContent = parsed.body.innerHTML;
      setPreviewHtml(`${inlineStyles}${bodyContent}`);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error building preview:", error);
      toast.error("No pudimos preparar la vista previa");
    }
  };

  // Paquete legal mensual (se ajusta automáticamente a mes completo)
  const snapToMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      first: first.toISOString().slice(0, 10),
      last: last.toISOString().slice(0, 10),
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  };

  const snapToMonthValue = (monthValue: string) => {
    if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
    const [year, month] = monthValue.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    return snapToMonth(d.toISOString());
  };

  const exportMonthlyCSV = (monthInfo: { ym: string; first: string; last: string }, centerId: string) => {
    const center = centers.find((c) => c.id === centerId);
    const headers = ["Fecha", "Empleado", "Email", "Entrada", "Salida", "Horas", "Modificada", "Revisada_por", "Comentario"];
    const reviewerLabel = (userId?: string | null) => {
      if (!userId) return "";
      const reviewer = employees.find((emp) => emp.id === userId);
      return reviewer?.full_name || reviewer?.email || "";
    };
    const filteredSessions = sessionsRaw.filter((s: any) => s.profiles?.center_id === centerId);
    const rows = filteredSessions.map((s: any) => {
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : null;
      const pauseMs = Number(s.total_pause_duration ?? 0);
      const durationMs =
        start && (end || true)
          ? (end ? end.getTime() : Date.now()) - start.getTime() - (isNaN(pauseMs) ? 0 : pauseMs)
          : 0;
      const hours = start ? (Math.max(0, durationMs) / (1000 * 60 * 60)).toFixed(2) : "";
      return [
        start ? start.toISOString().slice(0, 10) : end ? end.toISOString().slice(0, 10) : "",
        s.profiles?.full_name || s.profiles?.email || "",
        s.profiles?.email || "",
        start ? start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        end ? end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
        hours,
        s.is_corrected ? "Sí" : "No",
        reviewerLabel(s.corrected_by),
        s.correction_reason || "",
      ];
    });
    const label = center?.name ? center.name.replace(/\s+/g, "_") : "centro";
    exportCSV(`paquete_${label}_${monthInfo.ym}`, headers, rows);
  };

  const exportMonthlyPackage = () => {
    if (!monthlyCenter || monthlyCenter === "all") {
      toast.error("Selecciona un centro para generar el paquete mensual");
      return;
    }
    const snap = snapToMonthValue(monthlyMonth);
    if (!snap) {
      toast.error("Selecciona un mes válido");
      return;
    }
    // Ajusta los filtros al mes elegido
    setStartDate(snap.first);
    setEndDate(snap.last);
    setSelectedCenter(monthlyCenter);
    exportMonthlyCSV(snap, monthlyCenter);
    toast.success("Paquete mensual generado (CSV)");
    setMonthlyOpen(false);
  };

  const companyStats = employeeStats.filter((stat) => stat.company_id === companyId);

  const totalStats = {
    totalHours: companyStats.reduce((sum, s) => sum + s.total_hours, 0),
    totalEmployees: companyStats.length,
    avgPunctuality: companyStats.length > 0
      ? companyStats.reduce((sum, s) => sum + s.punctuality_score, 0) / companyStats.length
      : 0,
    totalIncidents: companyStats.reduce((sum, s) => sum + s.incidents, 0),
  };

  const selectedCenterLabel = useMemo(() => {
    if (selectedCenter === "all") return "Todos los centros";
    const found = centers.find((center) => center.id === selectedCenter);
    return found?.name ?? "Centro no disponible";
  }, [centers, selectedCenter]);

  const selectedEmployeeLabel = useMemo(() => {
    if (selectedEmployee === "all") return "Todos los empleados";
    const found = employees.find((emp) => emp.id === selectedEmployee);
    return found?.full_name || found?.email || "Empleado";
  }, [employees, selectedEmployee]);

  const formatDateLabel = useCallback((value: string) => {
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("es-ES");
  }, []);

  // Prefija selección mensual cuando se abre el modal
  const openMonthlyModal = () => {
    setMonthlyMonth(startDate.slice(0, 7));
    setMonthlyCenter(selectedCenter !== "all" ? selectedCenter : centers[0]?.id || "");
    setMonthlyOpen(true);
  };

  useEffect(() => {
    if (selectedCenter !== "all") {
      setMonthlyCenter(selectedCenter);
    } else if (centers[0]?.id) {
      setMonthlyCenter(centers[0].id);
    }
  }, [selectedCenter, centers]);

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-7xl mx-auto pt-8">
        <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-start md:items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover-scale"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Reportes y Métricas</h1>
              <p className="text-sm text-muted-foreground">
                {membership?.company.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hover-scale w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" /> Exportar CSV
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <Download className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openMonthlyModal}>
                  <FileText className="w-4 h-4 mr-2" /> Paquete legal mensual (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {showScheduleReminder && (
          <Alert className="glass-card border-primary/30 bg-primary/5">
            <AlertTitle className="flex items-center gap-2 text-primary">
              <CalendarClock className="w-4 h-4" />
              Configura tus jornadas y turnos
            </AlertTitle>
            <AlertDescription className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm">
              <span>
                Aún no detectamos ningún horario planificado para tu empresa. Configura calendarios,
                turnos o ausencias para que los reportes muestren horas previstas y alertas.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate("/manager-calendar")}>
                  Abrir calendario
                </Button>
                <Button variant="ghost" size="sm" onClick={dismissScheduleReminder}>
                  Omitir
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {pendingReviewCount > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <div className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-semibold">Fichadas pendientes de revisión</p>
                  <p className="text-sm">
                    {pendingReviewCount} fichada(s) superaron el límite de horas configurado. Ajusta la hora de
                    salida para normalizarlas.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {pendingReviewSessions.slice(0, 3).map((s) => (
                  <span key={`${s.user_id}-${s.clock_in_time}`} className="px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                    {s.profiles?.full_name || s.profiles?.email || "Empleado"} · {new Date(s.clock_in_time).toLocaleDateString("es-ES")}
                  </span>
                ))}
                {pendingReviewCount > 3 && <span>y {pendingReviewCount - 3} más…</span>}
              </div>
            </div>
          </Card>
        )}

        {pendingReviewCount > 0 && (
          <Card className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Corregir fichadas pendientes</h2>
                <p className="text-sm text-muted-foreground">
                  Ajusta la hora de salida y opcionalmente añade un motivo. Al guardar, la ficha queda normalizada.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {pendingReviewSessions.map((s) => {
                const defaultOut = toDatetimeLocal(s.clock_out_time || new Date().toISOString());
                const currentOut = adjustValues[s.id || ""]?.clock_out_time ?? defaultOut;
                const currentReason = adjustValues[s.id || ""]?.reason ?? "";
                const startLabel = new Date(s.clock_in_time).toLocaleString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={s.id || `${s.user_id}-${s.clock_in_time}`}
                    className="border rounded-lg p-3 bg-muted/30 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {s.profiles?.full_name || s.profiles?.email || "Empleado"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Entrada: {startLabel}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-destructive">
                        {s.review_status === "exceeded_limit" ? "Superó límite" : "Pendiente revisión"}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full md:w-auto md:flex-1">
                      <div className="space-y-1">
                        <Label htmlFor={`out-${s.id}`}>Salida corregida</Label>
                        <Input
                          id={`out-${s.id}`}
                          type="datetime-local"
                          value={currentOut}
                          onChange={(e) => setAdjustValue(s.id || "", "clock_out_time", e.target.value)}
                          disabled={!s.id || adjusting[s.id || ""]}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor={`reason-${s.id}`}>Motivo</Label>
                        <Input
                          id={`reason-${s.id}`}
                          placeholder="Ej. Olvidó fichar al salir"
                          value={currentReason}
                          onChange={(e) => setAdjustValue(s.id || "", "reason", e.target.value)}
                          disabled={!s.id || adjusting[s.id || ""]}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => s.id && handleAdjustSession(s)}
                        disabled={!s.id || adjusting[s.id || ""]}
                      >
                        {adjusting[s.id || ""] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Guardar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {role === "owner" && companyId && (
          <OwnerIndividualReports companyId={companyId} />
        )}

        {/* Filters */}
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Fecha inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="center">Centro</Label>
              <Select value={selectedCenter} onValueChange={setSelectedCenter}>
                <SelectTrigger id="center" className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los centros</SelectItem>
                  {centers.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="employee">Empleado</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee" className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name || emp.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="pendingReviewOnly"
                checked={onlyPendingReview}
                onCheckedChange={(v) => setOnlyPendingReview(v === true)}
              />
              <Label htmlFor="pendingReviewOnly" className="text-sm font-normal">
                Solo fichadas pendientes de revisar
              </Label>
            </div>
          </div>
        </Card>

        <div ref={reportRef} className="space-y-6">
        <Card className="glass-card p-6" data-report-section="context">
          <h2 className="text-lg font-semibold mb-4">Resumen del período</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Empresa</p>
              <p className="font-semibold">{membership?.company.name ?? "Sin empresa"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rango analizado</p>
              <p className="font-semibold">
                {formatDateLabel(startDate)} - {formatDateLabel(endDate)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Centro</p>
              <p className="font-semibold">{selectedCenterLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Empleado</p>
              <p className="font-semibold">{selectedEmployeeLabel}</p>
            </div>
          </div>
        </Card>

        {/* Location map */}
        <Card className="glass-card p-6" data-report-section="map">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Mapa de fichajes
                </h2>
                <p className="text-sm text-muted-foreground">
                  Visualiza desde dónde han fichado tus empleados en el período seleccionado.
                </p>
              </div>
              <div className="w-full md:w-64 space-y-1">
                <Label htmlFor="weekday-filter">Día de la semana</Label>
                <Select value={selectedWeekday} onValueChange={setSelectedWeekday}>
                  <SelectTrigger id="weekday-filter">
                    <SelectValue placeholder="Todos los días" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_FILTERS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr),minmax(240px,320px)]">
              <div className="rounded-xl border bg-muted/30 overflow-hidden relative min-h-[520px] lg:min-h-[620px]">
                <div ref={mapContainerRef} className="absolute inset-0" />
                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/80 backdrop-blur-sm">
                    Cargando ubicaciones...
                  </div>
                )}
                {!mapLoading && eventsWithCoords.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/70 backdrop-blur-sm text-center px-6">
                    No hay fichajes con coordenadas para este filtro.
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-secondary/40">
                  <p className="text-sm text-muted-foreground">Registros mostrados</p>
                  <p className="text-3xl font-bold">
                    {filteredMapEvents.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedWeekday === "all"
                      ? "Incluyendo todos los días"
                      : `Solo ${WEEKDAY_LABELS[Number(selectedWeekday)]}s`}
                  </p>
                  <div className="mt-3 text-sm">
                    Empleados únicos:{" "}
                    <span className="font-semibold">{uniqueEmployeesOnMap}</span>
                  </div>
                </div>
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {mapLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando ubicaciones...</p>
                  ) : filteredMapEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay fichajes con ubicación para este filtro.
                    </p>
                  ) : (
                    filteredMapEvents.slice(0, 5).map((event) => {
                      const eventDate = new Date(event.event_time);
                      const locationLabel = getLocationLabel(event.latitude, event.longitude);
                      return (
                        <div
                          key={event.id}
                          className="p-3 rounded-xl border bg-background/40 flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {event.profiles?.full_name || event.profiles?.email || "Empleado"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {eventDate.toLocaleDateString("es-ES", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                })}{" "}
                                ·{" "}
                                {eventDate.toLocaleTimeString("es-ES", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{locationLabel}</span>
                              </p>
                            </div>
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            Ver en Google Maps
                          </a>
                        </div>
                      );
                    })
                  )}
                  {filteredMapEvents.length > 5 && (
                    <p className="text-xs text-muted-foreground text-right">
                      Mostrando los últimos 5 registros
                    </p>
                  )}
                  {topGeoLocations.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Principales ubicaciones
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {topGeoLocations.map((location) => (
                          <div
                            key={location.key}
                            className="p-3 border rounded-lg bg-background/30"
                          >
                            <p className="text-sm font-medium leading-snug">
                              {location.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {location.count} fichajes
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-report-section="summary">
          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Totales</p>
                <p className="text-3xl font-bold mt-1">
                  {totalStats.totalHours.toFixed(0)}h
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Empleados</p>
                <p className="text-3xl font-bold mt-1">{totalStats.totalEmployees}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Puntualidad Media</p>
                <p className="text-3xl font-bold mt-1">
                  {totalStats.avgPunctuality.toFixed(0)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="glass-card p-6 hover-scale smooth-transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incidencias</p>
                <p className="text-3xl font-bold mt-1">{totalStats.totalIncidents}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Employee Stats Table */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Detalle por empleado
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="text-right">Retraso (min)</TableHead>
                  <TableHead className="text-right">Correctos</TableHead>
                  <TableHead className="text-right">Incidencias</TableHead>
                  <TableHead className="text-right">Puntualidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Cargando datos...
                    </TableCell>
                  </TableRow>
                ) : employeeStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay datos para el período seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  employeeStats.map((stat, index) => (
                    <TableRow key={stat.user_id} className="smooth-transition hover:bg-secondary/50">
                      <TableCell className="font-medium">
                        <div>
                          <div>{stat.full_name}</div>
                          <div className="text-xs text-muted-foreground">{stat.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {stat.total_hours.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right">{stat.total_days}</TableCell>
                      <TableCell className="text-right font-mono">
                        {stat.avg_delay.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">{stat.correct_checks}</TableCell>
                      <TableCell className="text-right">
                        {stat.incidents > 0 ? (
                          <Badge variant="destructive">{stat.incidents}</Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            stat.punctuality_score >= 90
                              ? "default"
                              : stat.punctuality_score >= 70
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {stat.punctuality_score.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
    </div>
    </div>
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="w-full max-w-5xl lg:max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vista previa del informe</DialogTitle>
          <DialogDescription>Revisa el contenido antes de descargar el PDF.</DialogDescription>
        </DialogHeader>
        <div
          className="border rounded-md p-4 bg-background/70 space-y-4"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDownloadPDF}>Descargar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={monthlyOpen} onOpenChange={setMonthlyOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paquete legal mensual (CSV)</DialogTitle>
          <DialogDescription>
            Selecciona el mes completo y el centro. Ajustaremos el rango al mes elegido antes de exportar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Mes</Label>
            <Input
              type="month"
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Centro</Label>
            <Select value={monthlyCenter} onValueChange={(val) => setMonthlyCenter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona centro" />
              </SelectTrigger>
              <SelectContent>
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
          <Button variant="ghost" onClick={() => setMonthlyOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={exportMonthlyPackage}>Exportar CSV</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Reports;
