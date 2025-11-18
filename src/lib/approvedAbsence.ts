export const APPROVED_ABSENCE_LABELS: Record<string, string> = {
  clock_in: "Entrada modificada",
  clock_out: "Salida modificada",
  pause_start: "Inicio de pausa modificado",
  pause_end: "Fin de pausa modificado",
}

export const getApprovedAbsenceTypeLabel = (eventType: string) => {
  if (!eventType) return "Ajuste aprobado";
  return APPROVED_ABSENCE_LABELS[eventType] || "Ajuste aprobado";
}

export const extractDateFromTimestamp = (timestamp: string | null | undefined) => {
  if (!timestamp) return null;
  const [datePart] = timestamp.split("T");
  return datePart ?? null;
}

export const extractTimeFromTimestamp = (timestamp: string | null | undefined) => {
  if (!timestamp) return null;
  const parts = timestamp.split("T");
  if (parts.length < 2) return null;
  return parts[1].slice(0, 5);
}
