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
  if (typeof window === "undefined") {
    throw new Error("popup-blocked");
  }

  const payloadId =
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as Crypto).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  try {
    sessionStorage.setItem(
      `print:${payloadId}`,
      JSON.stringify({
        title,
        body,
      })
    );
  } catch (error) {
    throw new Error("storage-failed");
  }

  const url = `${window.location.origin}/print/${payloadId}`;
  const win = window.open(url, "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!win || win.closed || typeof win.closed === "undefined") {
    sessionStorage.removeItem(`print:${payloadId}`);
    throw new Error("popup-blocked");
  }
};
