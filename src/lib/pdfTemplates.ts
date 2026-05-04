/**
 * Plantillas HTML pensadas para imprimirse a PDF con html2pdf.js
 * Estilo limpio, profesional y compatible con A4.
 */

export interface RgpdExportData {
  generatedAt: string;
  companyName: string;
  worker: {
    fullName: string;
    email: string;
    dni?: string | null;
    phone?: string | null;
    hireDate?: string | null;
  };
  workSessions: any[];
  timeEvents: any[];
  absences: any[];
  approvedAbsences: any[];
  correctionRequests: any[];
  notifications: any[];
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const baseStyles = `
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.5;
      margin: 0;
      padding: 24px;
    }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0f172a; }
    h2 { font-size: 14px; margin: 24px 0 8px; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 4px; }
    h3 { font-size: 12px; margin: 16px 0 6px; color: #1f2937; }
    p { margin: 4px 0; }
    .meta-card {
      background: #f1f5f9;
      border-left: 4px solid #0f766e;
      padding: 12px 16px;
      border-radius: 4px;
      margin: 12px 0 20px;
      font-size: 11px;
    }
    .meta-card strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; }
    .badge-green { background: #d1fae5; color: #047857; }
    .badge-red { background: #fee2e2; color: #b91c1c; }
    .badge-amber { background: #fef3c7; color: #b45309; }
    .badge-slate { background: #e2e8f0; color: #475569; }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      font-size: 9px;
      color: #64748b;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .header .brand { font-size: 18px; font-weight: 700; color: #0f172a; }
    .header .meta { text-align: right; font-size: 10px; color: #64748b; }
    .empty { color: #94a3b8; font-style: italic; padding: 8px; }
    .signature-img {
      max-width: 320px;
      max-height: 120px;
      border: 1px solid #cbd5e1;
      padding: 8px;
      background: white;
      margin-top: 8px;
    }
    .doc-content { background: #fafafa; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 12px 0; }
    .doc-content ul { padding-left: 20px; }
    .doc-content h2 { color: inherit; border: none; margin: 8px 0 4px; font-size: 13px; }
    .doc-content h3 { font-size: 11px; }
    .hash {
      font-family: ui-monospace, monospace;
      font-size: 9px;
      color: #475569;
      word-break: break-all;
    }
    .pageBreak { page-break-before: always; }
  </style>
`;

export function buildRgpdExportHtml(data: RgpdExportData): string {
  const w = data.worker;
  const renderTable = <T extends Record<string, any>>(
    rows: T[],
    columns: { label: string; get: (r: T) => string }[]
  ) => {
    if (!rows || rows.length === 0) {
      return `<p class="empty">No hay registros.</p>`;
    }
    const head = `<thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>`;
    const body = `<tbody>${rows
      .map(
        (r) =>
          `<tr>${columns.map((c) => `<td>${escapeHtml(String(c.get(r) ?? ""))}</td>`).join("")}</tr>`
      )
      .join("")}</tbody>`;
    return `<table>${head}${body}</table>`;
  };

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">${baseStyles}</head><body>
    <div class="header">
      <div>
        <div class="brand">GTIQ</div>
        <div style="font-size: 10px; color: #64748b;">Informe de datos personales</div>
      </div>
      <div class="meta">
        <div><strong>${escapeHtml(data.companyName)}</strong></div>
        <div>Generado el ${escapeHtml(fmtDateTime(data.generatedAt))}</div>
      </div>
    </div>

    <h1>Mis datos personales (RGPD)</h1>

    <div class="meta-card">
      <p><strong>Trabajador:</strong> ${escapeHtml(w.fullName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(w.email)}</p>
      ${w.dni ? `<p><strong>DNI/NIE:</strong> ${escapeHtml(w.dni)}</p>` : ""}
      ${w.phone ? `<p><strong>Teléfono:</strong> ${escapeHtml(w.phone)}</p>` : ""}
      ${w.hireDate ? `<p><strong>Fecha de alta:</strong> ${escapeHtml(fmtDate(w.hireDate))}</p>` : ""}
      <p style="margin-top: 8px; font-size: 10px;">
        Este documento se entrega en virtud del art. 15 del Reglamento (UE) 2016/679 (RGPD)
        y del art. 13 de la Ley Orgánica 3/2018. Contiene todos los datos personales
        que la empresa almacena en el sistema GTIQ sobre el interesado.
      </p>
    </div>

    <h2>1. Sesiones de trabajo (${data.workSessions.length})</h2>
    ${renderTable(data.workSessions, [
      { label: "Entrada", get: (r) => fmtDateTime(r.clock_in_time) },
      { label: "Salida", get: (r) => fmtDateTime(r.clock_out_time) },
      { label: "Horas", get: (r) => (r.total_hours ? Number(r.total_hours).toFixed(2) : "—") },
      { label: "Origen", get: (r) => r.source ?? "—" },
      { label: "Estado", get: (r) => (r.is_active ? "abierta" : "cerrada") },
    ])}

    <h2>2. Eventos de fichaje (${data.timeEvents.length})</h2>
    ${renderTable(data.timeEvents, [
      { label: "Fecha y hora", get: (r) => fmtDateTime(r.event_time) },
      { label: "Tipo", get: (r) => r.event_type ?? "—" },
      { label: "Origen", get: (r) => r.source ?? "—" },
      { label: "Latitud", get: (r) => (r.latitude ? r.latitude.toFixed(5) : "—") },
      { label: "Longitud", get: (r) => (r.longitude ? r.longitude.toFixed(5) : "—") },
    ])}

    <h2>3. Ausencias (${data.absences.length})</h2>
    ${renderTable(data.absences, [
      { label: "Tipo", get: (r) => r.absence_type ?? "—" },
      { label: "Inicio", get: (r) => fmtDate(r.start_date) },
      { label: "Fin", get: (r) => fmtDate(r.end_date) },
      { label: "Estado", get: (r) => r.status ?? "—" },
      { label: "Motivo", get: (r) => r.reason ?? "—" },
    ])}

    <h2>4. Ajustes aprobados (${data.approvedAbsences.length})</h2>
    ${renderTable(data.approvedAbsences, [
      { label: "Fecha", get: (r) => fmtDate(r.date) },
      { label: "Tipo", get: (r) => r.absence_type ?? "—" },
      { label: "Hora", get: (r) => r.time_change ?? "—" },
      { label: "Notas", get: (r) => r.notes ?? "—" },
    ])}

    <h2>5. Solicitudes de corrección (${data.correctionRequests.length})</h2>
    ${renderTable(data.correctionRequests, [
      { label: "Solicitada", get: (r) => fmtDateTime(r.created_at) },
      { label: "Estado", get: (r) => r.status ?? "—" },
      { label: "Motivo", get: (r) => r.reason ?? "—" },
    ])}

    <h2>6. Notificaciones (${data.notifications.length})</h2>
    ${renderTable(data.notifications.slice(0, 50), [
      { label: "Fecha", get: (r) => fmtDateTime(r.created_at) },
      { label: "Título", get: (r) => r.title ?? "—" },
      { label: "Mensaje", get: (r) => r.message ?? "—" },
    ])}
    ${data.notifications.length > 50 ? `<p class="empty">Mostrando últimas 50 de ${data.notifications.length}.</p>` : ""}

    <div class="footer">
      Documento generado automáticamente por GTIQ. Para verificación o reclamaciones
      contacta con tu empresa o con el delegado de protección de datos. Conservación
      mínima legal: 4 años desde el cese de la relación laboral.
    </div>
  </body></html>`;
}

export interface SignedAcceptancePdfData {
  companyName: string;
  fullName: string;
  dni?: string | null;
  documentTitle: string;
  documentHtml: string;
  signatureImage: string; // data URL PNG
  signedAt: string;
  documentHash: string;
  geo?: { lat: number; lng: number } | null;
}

export function buildSignedAcceptancePdfHtml(d: SignedAcceptancePdfData): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">${baseStyles}</head><body>
    <div class="header">
      <div>
        <div class="brand">GTIQ</div>
        <div style="font-size: 10px; color: #64748b;">Documento firmado digitalmente</div>
      </div>
      <div class="meta">
        <div><strong>${escapeHtml(d.companyName)}</strong></div>
        <div>${escapeHtml(fmtDateTime(d.signedAt))}</div>
      </div>
    </div>

    <h1>${escapeHtml(d.documentTitle)}</h1>

    <div class="meta-card">
      <p><strong>Firmante:</strong> ${escapeHtml(d.fullName)}</p>
      ${d.dni ? `<p><strong>DNI/NIE:</strong> ${escapeHtml(d.dni)}</p>` : ""}
      <p><strong>Fecha y hora de firma:</strong> ${escapeHtml(fmtDateTime(d.signedAt))}</p>
      ${d.geo ? `<p><strong>Geolocalización:</strong> ${d.geo.lat.toFixed(5)}, ${d.geo.lng.toFixed(5)}</p>` : ""}
    </div>

    <div class="doc-content">${d.documentHtml}</div>

    <h3>Firma del trabajador</h3>
    <img class="signature-img" src="${d.signatureImage}" alt="Firma" />

    <div class="footer">
      <p><strong>Hash de integridad SHA-256 del contenido:</strong></p>
      <p class="hash">${escapeHtml(d.documentHash)}</p>
      <p style="margin-top: 8px;">
        Cualquier modificación posterior del contenido invalidaría este hash.
        Documento generado y firmado digitalmente en GTIQ.
      </p>
    </div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
