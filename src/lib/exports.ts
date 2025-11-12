export const exportCSV = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
  const esc = (val: any) => {
    const s = val === null || val === undefined ? "" : String(val);
    if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const content = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  // BOM for Excel UTF-8
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printHTML = (title: string, body: string) => {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!win) return;
  win.document.open();
  win.document.write(`<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root { --fg:#0f172a; --muted:#64748b; --border:#e2e8f0; --accent:#0ea5e9; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; color: var(--fg); }
        .wrap { max-width: 1024px; margin: 24px auto; padding: 0 16px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: var(--muted); font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid var(--border); padding: 8px 10px; font-size: 12px; text-align: left; }
        th { background: #f8fafc; }
        footer { margin-top: 16px; font-size: 11px; color: var(--muted); }
      </style>
    </head>
    <body>
      <div class="wrap">
        ${body}
        <footer>
          Este documento incluye datos de registro horario. Las correcciones deben mantenerse auditadas. Conservación mínima conforme a RDL 8/2019.
        </footer>
      </div>
      <script>window.onload = () => setTimeout(() => window.print(), 100);</script>
    </body>
  </html>`);
  win.document.close();
};

