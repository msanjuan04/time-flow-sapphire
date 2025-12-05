// SQL:
// create table if not exists clock_in_reminders (
//   id uuid primary key default gen_random_uuid(),
//   worker_id uuid not null references profiles(id) on delete cascade,
//   date date not null,
//   shift_start_time time not null,
//   created_at timestamptz not null default now(),
//   unique (worker_id, date, shift_start_time)
// );

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TZ = "Europe/Madrid";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Worker {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string;
  is_active?: boolean;
}

interface Schedule {
  worker_id: string;
  start_time: string;
  end_time: string;
  company_id?: string | null;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function parseDateParts(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return { y, m: m - 1, d };
}

// Returns a Date instance that, when formatted in TZ, shows the provided local time.
function makeTzDate(dateISO: string, time: string) {
  const { y, m, d } = parseDateParts(dateISO);
  const [hh, mm] = time.split(":").map(Number);
  const desiredMinutes = hh * 60 + mm;
  const utcGuess = new Date(Date.UTC(y, m, d, hh, mm));
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(utcGuess);
  const actualH = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const actualM = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const actualMinutes = actualH * 60 + actualM;
  const deltaMinutes = desiredMinutes - actualMinutes;
  return addMinutes(utcGuess, deltaMinutes);
}

function getNowTz() {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    if (p.type !== "literal") map[p.type] = p.value;
  });
  const isoLocal = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`;
  return { dateISO: `${map.year}-${map.month}-${map.day}`, timeHM: `${map.hour}:${map.minute}`, date: new Date(isoLocal) };
}

async function fetchActiveWorkers(): Promise<Worker[]> {
  // Usa memberships para obtener company_id y filtra perfiles activos
  const { data, error } = await supabase
    .from("memberships")
    .select("company_id, user_id:profiles(id, full_name, email, is_active)")
    .eq("role", "worker");
  if (error) throw error;
  return (data || [])
    .map((row: any) => ({
      id: row.user_id?.id,
      full_name: row.user_id?.full_name ?? null,
      email: row.user_id?.email ?? null,
      company_id: row.company_id,
      is_active: row.user_id?.is_active ?? true,
    }))
    .filter((w: Worker) => !!w.id && !!w.company_id && w.is_active);
}

async function fetchSchedules(workerIds: string[], weekday: number): Promise<Schedule[]> {
  if (workerIds.length === 0) return [];
  const { data, error } = await supabase
    .from("worker_schedules")
    .select("worker_id, start_time, end_time, company_id")
    .in("worker_id", workerIds)
    .eq("weekday", weekday);
  if (error) throw error;
  return data as Schedule[];
}

async function fetchHolidays(dateISO: string): Promise<boolean> {
  const { data, error } = await supabase.from("public_holidays").select("id").eq("date", dateISO).limit(1).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function fetchAbsences(workerIds: string[], dateISO: string): Promise<Set<string>> {
  if (workerIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("absences")
    .select("worker_id")
    .in("worker_id", workerIds)
    .eq("date", dateISO)
    .eq("covers_full_day", true);
  if (error) throw error;
  return new Set((data || []).map((row) => row.worker_id));
}

async function hasClockIn(workerId: string, companyId: string, from: Date, to: Date) {
  const { data, error } = await supabase
    .from("time_events")
    .select("id")
    .eq("worker_id", workerId)
    .eq("company_id", companyId)
    .eq("event_type", "clock_in")
    .gte("event_time", from.toISOString())
    .lte("event_time", to.toISOString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function hasReminder(workerId: string, dateISO: string, shiftStart: string) {
  const { data, error } = await supabase
    .from("clock_in_reminders")
    .select("id")
    .eq("worker_id", workerId)
    .eq("date", dateISO)
    .eq("shift_start_time", shiftStart)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function insertReminder(workerId: string, dateISO: string, shiftStart: string) {
  const { error } = await supabase.from("clock_in_reminders").insert({
    worker_id: workerId,
    date: dateISO,
    shift_start_time: shiftStart,
  });
  if (error) throw error;
}

async function sendReminderEmail(worker: Worker) {
  if (!worker.email) return;
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing, cannot send email");
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "GTiQ <no-reply@gtiq.com>",
      to: [worker.email],
      subject: "Recordatorio: acuérdate de fichar en GTiQ",
      html: `
        <p>Hola ${worker.full_name || ""},</p>
        <p>Hemos detectado que ha empezado tu horario de trabajo y todavía no has fichado.</p>
        <p>Por favor, entra en la aplicación y registra tu fichaje:</p>
        <p><a href="https://gneritq.com">https://gneritq.com</a></p>
        <p>— El equipo de GTiQ</p>
      `,
    }),
  });
  if (!response.ok) {
    console.error("Resend email failed:", await response.text());
  }
}

serve(async () => {
  let sentReminders = 0;
  let checkedWorkers = 0;

  try {
    const { date: now, dateISO } = getNowTz();
    const weekday = new Date(dateISO).getDay();
    const workers = await fetchActiveWorkers();
    const workerIds = workers.map((w) => w.id);

    const [schedules, isHoliday, absences] = await Promise.all([
      fetchSchedules(workerIds, weekday),
      fetchHolidays(dateISO),
      fetchAbsences(workerIds, dateISO),
    ]);

    if (isHoliday) {
      return new Response(JSON.stringify({ sentReminders, checkedWorkers }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const schedulesByWorker = schedules.reduce<Record<string, Schedule[]>>((acc, sch) => {
      acc[sch.worker_id] = acc[sch.worker_id] || [];
      acc[sch.worker_id].push(sch);
      return acc;
    }, {});

    for (const worker of workers) {
      checkedWorkers++;
      if (absences.has(worker.id)) continue;
      const workerSchedules = schedulesByWorker[worker.id] || [];
      if (workerSchedules.length === 0) continue;

      for (const sch of workerSchedules) {
        const startDateTime = makeTzDate(dateISO, sch.start_time);
        const reminderTime = addMinutes(startDateTime, 10);
        const reminderWindowEnd = addMinutes(reminderTime, 1);

        if (now < reminderTime || now > reminderWindowEnd) continue;

        // Usa company_id del schedule si existe, si no del worker
        const companyId = sch.company_id || worker.company_id;

        const alreadyReminded = await hasReminder(worker.id, dateISO, sch.start_time);
        if (alreadyReminded) continue;

        const windowStart = addMinutes(startDateTime, -30);
        const hasIn = await hasClockIn(worker.id, companyId, windowStart, reminderTime);
        if (hasIn) continue;

        await insertReminder(worker.id, dateISO, sch.start_time);
        await sendReminderEmail(worker);
        sentReminders++;
      }
    }

    return new Response(JSON.stringify({ sentReminders, checkedWorkers }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in clock-in-reminders", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
