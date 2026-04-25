import { supabase } from "@/integrations/supabase/client";
import { loadCompanyHolidayDates } from "@/lib/companyHolidays";

export type CountType = "working" | "natural";

export interface VacationPolicy {
  annual_days: number;
  count_type: CountType;
  block_over_balance: boolean;
}

export interface VacationBalance {
  assigned_days: number;
  accrued_days: number;
  used_days: number;
  pending_days: number;
  available_days: number;
}

export interface VacationCheckResult {
  /** true if approving this request would NOT exceed available balance */
  withinBalance: boolean;
  /** true if approval must be blocked (exceeds AND policy enforces blocking) */
  shouldBlock: boolean;
  /** Days the request would consume (working or natural depending on policy) */
  requestedDays: number;
  /** Available days at the time of check */
  availableDays: number;
  /** Excess (positive number) if requestedDays > availableDays, else 0 */
  excessDays: number;
  /** Policy used for the calculation. null if no policy row found (defaults applied). */
  policy: VacationPolicy | null;
  balance: VacationBalance | null;
  /** Friendly Spanish message to show in toasts/badges */
  message: string;
}

/**
 * Counts the days between two ISO dates (inclusive) according to count_type.
 * - 'natural': every calendar day counts (festivos NO se descuentan en cómputo natural).
 * - 'working': excludes Saturdays, Sundays AND holiday dates (if provided).
 */
export function countVacationDays(
  startISO: string,
  endISO: string,
  countType: CountType,
  holidayDates?: Set<string>
): number {
  if (!startISO || !endISO) return 0;
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    if (countType === "natural") {
      days += 1;
    } else {
      const dow = cur.getDay(); // 0=Sun, 6=Sat
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidayDates ? holidayDates.has(iso) : false;
      if (!isWeekend && !isHoliday) days += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Loads the vacation policy for a company. Returns sensible defaults if
 * the row doesn't exist (so the guard never crashes on companies that
 * haven't configured a policy yet).
 */
export async function loadVacationPolicy(
  companyId: string
): Promise<VacationPolicy | null> {
  if (!companyId) return null;
  const { data, error } = await supabase
    .from("vacation_policies")
    .select("annual_days, count_type, block_over_balance")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) {
    console.warn("loadVacationPolicy error:", error.message);
    return null;
  }
  return (data as VacationPolicy) || null;
}

/**
 * Loads the current vacation balance for a user via the SQL RPC.
 */
export async function loadVacationBalance(
  userId: string,
  companyId: string,
  year?: number
): Promise<VacationBalance | null> {
  if (!userId || !companyId) return null;
  const params: Record<string, any> = {
    p_user_id: userId,
    p_company_id: companyId,
  };
  if (year) params.p_year = year;
  const { data, error } = await supabase.rpc("get_vacation_balance", params);
  if (error) {
    console.warn("loadVacationBalance error:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as VacationBalance) || null;
}

/**
 * Main entry point: check whether approving a vacation absence request would
 * exceed the user's balance and whether it must be blocked.
 *
 * Pass the request period (start/end ISO dates).
 */
export async function checkVacationApproval(opts: {
  userId: string;
  companyId: string;
  startDate: string;
  endDate: string;
}): Promise<VacationCheckResult> {
  const [policy, balance, holidayDates] = await Promise.all([
    loadVacationPolicy(opts.companyId),
    loadVacationBalance(opts.userId, opts.companyId),
    loadCompanyHolidayDates(opts.companyId),
  ]);

  const countType: CountType = policy?.count_type ?? "working";
  const blockEnabled = policy?.block_over_balance ?? true;

  const requestedDays = countVacationDays(
    opts.startDate,
    opts.endDate,
    countType,
    holidayDates
  );
  const availableDays = Number(balance?.available_days ?? 0);
  const excessDays = Math.max(0, requestedDays - availableDays);
  const withinBalance = excessDays === 0;
  const shouldBlock = !withinBalance && blockEnabled;

  let message = "";
  if (requestedDays === 0) {
    message = "No se pudo calcular los días solicitados";
  } else if (withinBalance) {
    message = `Solicita ${requestedDays} ${requestedDays === 1 ? "día" : "días"} (saldo disponible: ${availableDays.toFixed(1)})`;
  } else {
    message = `Solicita ${requestedDays} ${requestedDays === 1 ? "día" : "días"} pero solo quedan ${availableDays.toFixed(1)} disponibles. Excede en ${excessDays.toFixed(1)}.`;
  }

  return {
    withinBalance,
    shouldBlock,
    requestedDays,
    availableDays,
    excessDays,
    policy,
    balance,
    message,
  };
}

/**
 * Heuristic: is this correction_request actually a vacation/absence request
 * that we should guard? Looks at payload.type === 'absence' and that it has
 * date range. Reason text is also checked to skip non-vacation absences
 * (e.g. médica, asuntos propios) — only count as vacation when the reason
 * looks like vacaciones/holidays.
 */
export function isVacationAbsenceRequest(payload: any, reason?: string | null): boolean {
  if (!payload) return false;
  if (payload.type !== "absence") return false;
  if (!payload.start_date || !payload.end_date) return false;
  const r = (reason || payload.reason || "").toString().toLowerCase();
  // If reason mentions vacation explicitly, treat as vacation. Other absence
  // types (médica, paternidad, asuntos propios…) are out of scope of the
  // vacation balance guard — they have their own legal accruals.
  return /vacacion|vacation|holiday/.test(r) || r === "" || r === "vacaciones";
}
