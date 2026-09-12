import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { sendPushToAll } from "../_shared/webpush.ts";
import {
  dateKeyInTimeZone,
  entryReferences,
  exitReferences,
  hasUsableSchedule,
  minutesInTimeZone,
  type DaySchedule,
} from "../_shared/scheduleWindow.ts";

/**
 * Recordatorios de fichaje al móvil. Corre cada cinco minutos.
 *
 * Dos avisos, como mucho uno de cada por persona y día:
 *   - No has fichado la entrada: tenía horario, ya pasó su hora más el
 *     margen de cortesía, y no hay ninguna entrada hoy.
 *   - No has fichado la salida: sigue con la jornada abierta pasada su hora
 *     de salida. Este es el que evita la mayoría de las correcciones.
 *
 * Sustituye a clock-in-reminders, que consultaba una tabla inexistente
 * (worker_schedules) y llevaba desde diciembre de 2025 fallando en silencio.
 */

const LATE_ENTRY_GRACE = 20; // minutos tras la hora de entrada
const LATE_EXIT_GRACE = 15; // minutos tras la hora de salida
const MAX_LATE_WINDOW = 240; // no avisar de algo de hace más de 4 horas

interface ScheduleRow extends DaySchedule {
  user_id: string;
  company_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return createErrorResponse("Configuración incompleta", 500);

    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const now = new Date();
    const today = dateKeyInTimeZone(now);
    const nowMinutes = minutesInTimeZone(now);

    const { data: schedules } = await db
      .from("scheduled_hours")
      .select("user_id, company_id, start_time, end_time, morning_end_time, afternoon_start_time, expected_hours")
      .eq("date", today);

    const rows = ((schedules ?? []) as ScheduleRow[]).filter((s) => hasUsableSchedule(s));
    if (rows.length === 0) {
      return createJsonResponse({ success: true, checked: 0, sent: 0 });
    }

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

    const [eventsRes, sessionsRes, absencesRes, sentRes, subsRes, profilesRes] = await Promise.all([
      db
        .from("time_events")
        .select("user_id, event_type, event_time")
        .in("user_id", userIds)
        .gte("event_time", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString()),
      db.from("work_sessions").select("user_id, clock_in_time").in("user_id", userIds).eq("is_active", true),
      db
        .from("absences")
        .select("user_id")
        .in("user_id", userIds)
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today),
      db.from("shift_reminders_log").select("user_id, kind").eq("date", today),
      db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds),
      db.from("profiles").select("id, is_active").in("id", userIds),
    ]);

    const todayEvents = (eventsRes.data ?? []).filter((e) => dateKeyInTimeZone(new Date(e.event_time)) === today);
    const clockInsToday = new Set(todayEvents.filter((e) => e.event_type === "clock_in").map((e) => e.user_id));
    const activeSessions = new Set((sessionsRes.data ?? []).map((s) => s.user_id));
    const absentToday = new Set((absencesRes.data ?? []).map((a) => a.user_id));
    const inactive = new Set((profilesRes.data ?? []).filter((p) => p.is_active === false).map((p) => p.id));
    const alreadySent = new Set((sentRes.data ?? []).map((r) => `${r.user_id}|${r.kind}`));

    const subsByUser = new Map<string, { id: string; endpoint: string; p256dh: string; auth: string }[]>();
    for (const s of subsRes.data ?? []) {
      const list = subsByUser.get(s.user_id) ?? [];
      list.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
      subsByUser.set(s.user_id, list);
    }

    const pending: { row: ScheduleRow; kind: "missing_clock_in" | "missing_clock_out"; reference: number }[] = [];

    for (const row of rows) {
      if (absentToday.has(row.user_id) || inactive.has(row.user_id)) continue;

      // Salida olvidada: jornada abierta pasada la hora de salida del día.
      if (activeSessions.has(row.user_id)) {
        const lastExit = Math.max(...exitReferences(row));
        const late = nowMinutes - lastExit;
        if (late >= LATE_EXIT_GRACE && late <= MAX_LATE_WINDOW && !alreadySent.has(`${row.user_id}|missing_clock_out`)) {
          pending.push({ row, kind: "missing_clock_out", reference: lastExit });
        }
        continue;
      }

      // Entrada olvidada: nadie ha fichado hoy y ya pasó su hora de entrada.
      if (!clockInsToday.has(row.user_id)) {
        const firstEntry = Math.min(...entryReferences(row));
        const late = nowMinutes - firstEntry;
        if (late >= LATE_ENTRY_GRACE && late <= MAX_LATE_WINDOW && !alreadySent.has(`${row.user_id}|missing_clock_in`)) {
          pending.push({ row, kind: "missing_clock_in", reference: firstEntry });
        }
      }
    }

    let sent = 0;
    const gone: string[] = [];

    for (const item of pending) {
      const subs = subsByUser.get(item.row.user_id) ?? [];
      const hhmm = `${String(Math.floor(item.reference / 60)).padStart(2, "0")}:${String(item.reference % 60).padStart(2, "0")}`;

      if (subs.length > 0) {
        const result = await sendPushToAll(subs, {
          title: item.kind === "missing_clock_out" ? "Te falta fichar la salida" : "Te falta fichar la entrada",
          body:
            item.kind === "missing_clock_out"
              ? `Tu turno terminaba a las ${hhmm} y sigues fichado. Ficha la salida o avisa a tu responsable.`
              : `Tu turno empezaba a las ${hhmm} y no consta tu entrada.`,
          url: "/me/clock",
          tag: `gtiq-${item.kind}`,
        });
        sent += result.sent;
        gone.push(...result.gone);
      }

      // Queda constancia aunque no tenga el móvil configurado: así el aviso
      // le aparece igualmente dentro de la aplicación.
      await db.from("notifications").insert({
        company_id: item.row.company_id,
        user_id: item.row.user_id,
        title: item.kind === "missing_clock_out" ? "Te falta fichar la salida" : "Te falta fichar la entrada",
        message:
          item.kind === "missing_clock_out"
            ? `Tu turno terminaba a las ${hhmm} y tu jornada sigue abierta.`
            : `Tu turno empezaba a las ${hhmm} y no consta tu entrada de hoy.`,
        type: "warning",
        entity_type: "shift_reminder",
        entity_id: `${item.row.user_id}-${today}-${item.kind}`,
      });

      await db.from("shift_reminders_log").insert({
        user_id: item.row.user_id,
        company_id: item.row.company_id,
        date: today,
        kind: item.kind,
      });
    }

    if (gone.length) {
      await db.from("push_subscriptions").delete().in("endpoint", gone);
    }

    return createJsonResponse({
      success: true,
      checked: rows.length,
      reminders: pending.length,
      sent,
      removed_subscriptions: gone.length,
    });
  } catch (err) {
    console.error("shift-reminders error:", err);
    return createErrorResponse("Error inesperado en los recordatorios", 500);
  }
});
