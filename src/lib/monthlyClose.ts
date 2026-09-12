import { supabase } from "@/integrations/supabase/client";
import { extractFunctionErrorMessage } from "@/lib/offlineClockQueue";
import type { MonthSummary, MonthTotals } from "../../supabase/functions/_shared/monthSummary";

/**
 * Cierre mensual: resumen de horas del mes, horas extra y firma del
 * trabajador. Todo pasa por la edge function sign-month, que recalcula el
 * mes en el servidor y sella el hash de lo firmado.
 */

export type SignoffStatus = "pending" | "signed" | "disputed";

export interface Signoff {
  status: SignoffStatus;
  signed_at: string | null;
  summary_hash: string | null;
  signature: { note?: string | null; totals?: MonthTotals } | null;
}

export interface MonthState {
  summary: MonthSummary;
  hash: string;
  month_is_over: boolean;
  signoff: Signoff | null;
  /** Se corrigió algún fichaje del mes después de firmar. */
  outdated: boolean;
}

export interface MonthTeamRow {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  totals: MonthTotals;
  signoff: Signoff | null;
  outdated: boolean;
}

const call = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("sign-month", { body });
  if (error) {
    const message = await extractFunctionErrorMessage(error, data);
    throw new Error(message || "No se pudo completar la operación");
  }
  return data as T;
};

export const fetchMonthState = (companyId: string, year: number, month: number, userId?: string) =>
  call<MonthState>({ action: "summary", company_id: companyId, year, month, user_id: userId });

export const fetchMonthTeam = (companyId: string, year: number, month: number) =>
  call<{ month_is_over: boolean; rows: MonthTeamRow[] }>({
    action: "list",
    company_id: companyId,
    year,
    month,
  });

export const signMonth = (
  companyId: string,
  year: number,
  month: number,
  decision: "signed" | "disputed",
  note?: string
) => call<{ status: SignoffStatus }>({ action: "sign", company_id: companyId, year, month, decision, note });

/** 7.5 → "7,5 h" */
export const formatHoras = (hours: number): string =>
  `${Number(hours ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })} h`;

export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const monthLabel = (year: number, month: number) => `${MONTH_NAMES[month - 1]} de ${year}`;

/** Último mes ya terminado, que es el que toca firmar. */
export const lastClosedMonth = (now: Date = new Date()): { year: number; month: number } => {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

export const shiftMonth = (year: number, month: number, delta: number) => {
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

export const isFutureMonth = (year: number, month: number, now: Date = new Date()) =>
  year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

export const SIGNOFF_LABELS: Record<SignoffStatus, string> = {
  pending: "Pendiente de firma",
  signed: "Conforme",
  disputed: "En disconformidad",
};
