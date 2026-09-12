import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { buildMonthSummary, canonicalMonthSummary, type MonthSummary } from "../_shared/monthSummary.ts";
import { dateKeyInTimeZone } from "../_shared/scheduleWindow.ts";

/**
 * Cierre mensual del registro de jornada.
 *
 * El artículo 35.5 del Estatuto obliga a totalizar las horas extraordinarias
 * en cada periodo de abono y entregar copia al trabajador. Aquí el
 * trabajador ve su mes y lo firma en conformidad o disconformidad.
 *
 * Acciones:
 *   summary  el resumen del mes y el estado de la firma. El trabajador ve el
 *            suyo; owner, admin y manager pueden ver el de cualquiera.
 *   sign     el trabajador firma su propio mes. Solo meses ya terminados.
 *   list     estado de todo el equipo en un mes (solo responsables).
 *
 * El resumen se recalcula siempre en el servidor: lo que se firma es el
 * hash de ese cálculo, no lo que diga el navegador. Si después se corrige
 * un fichaje del mes, el hash deja de cuadrar y se ve en pantalla.
 */

const STAFF_ROLES = ["owner", "admin", "manager"];

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const monthBounds = (year: number, month: number) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { first: `${year}-${pad(month)}-01`, last: `${year}-${pad(month)}-${pad(last)}` };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions();

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!url || !serviceKey || !anonKey) return createErrorResponse("Configuración incompleta", 500);

    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user },
    } = await asUser.auth.getUser();
    if (!user) return createErrorResponse("No autenticado", 401);

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "summary";
    const companyId: string = body?.company_id;
    const year = Number(body?.year);
    const month = Number(body?.month);

    if (!companyId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return createErrorResponse("company_id, year y month son obligatorios", 400);
    }

    // Rol de quien llama en esa empresa
    const { data: membership } = await db
      .from("memberships")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return createErrorResponse("No perteneces a esta empresa", 403);
    const isStaff = STAFF_ROLES.includes(membership.role);

    const { first, last } = monthBounds(year, month);
    const todayKey = dateKeyInTimeZone(new Date());
    const monthIsOver = `${year}-${String(month).padStart(2, "0")}` < todayKey.slice(0, 7);

    /** Recalcula el mes de una persona desde los fichajes. */
    const summaryFor = async (targetUserId: string): Promise<MonthSummary> => {
      // Un día de margen a cada lado por los turnos que cruzan medianoche.
      const from = new Date(`${first}T00:00:00Z`);
      from.setUTCDate(from.getUTCDate() - 1);
      const to = new Date(`${last}T23:59:59Z`);
      to.setUTCDate(to.getUTCDate() + 1);

      const [eventsRes, schedulesRes, absencesRes] = await Promise.all([
        db
          .from("time_events")
          .select("event_type, event_time")
          .eq("company_id", companyId)
          .eq("user_id", targetUserId)
          .gte("event_time", from.toISOString())
          .lte("event_time", to.toISOString())
          .order("event_time", { ascending: true }),
        db
          .from("scheduled_hours")
          .select("date, expected_hours")
          .eq("company_id", companyId)
          .eq("user_id", targetUserId)
          .gte("date", first)
          .lte("date", last),
        db
          .from("absences")
          .select("start_date, end_date, absence_type")
          .eq("company_id", companyId)
          .eq("user_id", targetUserId)
          .eq("status", "approved")
          .lte("start_date", last)
          .gte("end_date", first),
      ]);

      return buildMonthSummary({
        year,
        month,
        events: eventsRes.data ?? [],
        schedules: schedulesRes.data ?? [],
        absences: absencesRes.data ?? [],
        dateKey: (d) => dateKeyInTimeZone(d),
      });
    };

    const signoffFor = async (targetUserId: string) => {
      const { data } = await db
        .from("monthly_signoffs")
        .select("status, signed_at, summary_hash, signature")
        .eq("company_id", companyId)
        .eq("user_id", targetUserId)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      return data ?? null;
    };

    // ── summary ────────────────────────────────────────
    if (action === "summary") {
      const targetUserId: string = body?.user_id ?? user.id;
      if (targetUserId !== user.id && !isStaff) return createErrorResponse("Sin permiso", 403);

      const summary = await summaryFor(targetUserId);
      const hash = await sha256Hex(canonicalMonthSummary(targetUserId, companyId, summary));
      const signoff = await signoffFor(targetUserId);

      return createJsonResponse({
        success: true,
        summary,
        hash,
        month_is_over: monthIsOver,
        signoff,
        // Si se corrigió un fichaje después de firmar, el hash ya no cuadra.
        outdated: Boolean(signoff?.summary_hash && signoff.summary_hash !== hash),
      });
    }

    // ── sign ───────────────────────────────────────────
    if (action === "sign") {
      const decision: string = body?.decision ?? "signed";
      if (!["signed", "disputed"].includes(decision)) {
        return createErrorResponse("decision debe ser 'signed' o 'disputed'", 400);
      }
      if (!monthIsOver) return createErrorResponse("El mes todavía no ha terminado", 400);

      const summary = await summaryFor(user.id);
      const hash = await sha256Hex(canonicalMonthSummary(user.id, companyId, summary));
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
      if (decision === "disputed" && note.length < 3) {
        return createErrorResponse("Explica brevemente el motivo de la disconformidad", 400);
      }

      const { error } = await db.from("monthly_signoffs").upsert(
        {
          company_id: companyId,
          user_id: user.id,
          year,
          month,
          status: decision,
          signed_at: new Date().toISOString(),
          summary_hash: hash,
          signature: {
            note: note || null,
            totals: summary.totals,
            ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            user_agent: req.headers.get("user-agent") ?? null,
            signed_at: new Date().toISOString(),
          },
          changed_by: user.id,
        },
        { onConflict: "company_id,user_id,year,month" },
      );
      if (error) {
        console.error("monthly_signoffs upsert failed:", error);
        return createErrorResponse("No se pudo guardar la firma", 500);
      }

      // Aviso a los responsables, sobre todo si hay disconformidad.
      try {
        const { data: staff } = await db
          .from("memberships")
          .select("user_id")
          .eq("company_id", companyId)
          .in("role", STAFF_ROLES);
        const { data: profile } = await db.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
        const label = profile?.full_name || profile?.email || "Un trabajador";
        const rows = (staff ?? [])
          .map((s: { user_id: string }) => s.user_id)
          .filter((id: string) => id !== user.id)
          .map((id: string) => ({
            company_id: companyId,
            user_id: id,
            title: decision === "signed" ? "Mes firmado" : "Mes firmado en disconformidad",
            message:
              decision === "signed"
                ? `${label} ha dado su conformidad al registro de ${String(month).padStart(2, "0")}/${year}.`
                : `${label} ha firmado ${String(month).padStart(2, "0")}/${year} en disconformidad: ${note}`,
            type: decision === "signed" ? "info" : "warning",
            entity_type: "monthly_signoff",
            entity_id: `${user.id}-${year}-${month}`,
          }));
        if (rows.length) await db.from("notifications").insert(rows);
      } catch (notifyError) {
        console.error("monthly signoff notification failed:", notifyError);
      }

      return createJsonResponse({ success: true, status: decision, hash, summary });
    }

    // ── list ───────────────────────────────────────────
    if (action === "list") {
      if (!isStaff) return createErrorResponse("Sin permiso", 403);

      const { data: members } = await db
        .from("memberships")
        .select("user_id, role, profiles!inner(full_name, email)")
        .eq("company_id", companyId);

      const rows = [];
      for (const m of members ?? []) {
        const profile = Array.isArray((m as any).profiles) ? (m as any).profiles[0] : (m as any).profiles;
        const summary = await summaryFor(m.user_id);
        const hash = await sha256Hex(canonicalMonthSummary(m.user_id, companyId, summary));
        const signoff = await signoffFor(m.user_id);
        rows.push({
          user_id: m.user_id,
          role: m.role,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          totals: summary.totals,
          signoff,
          outdated: Boolean(signoff?.summary_hash && signoff.summary_hash !== hash),
        });
      }

      rows.sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "", "es"));
      return createJsonResponse({ success: true, month_is_over: monthIsOver, rows });
    }

    return createErrorResponse("Acción no válida", 400);
  } catch (err) {
    console.error("sign-month error:", err);
    return createErrorResponse("Error inesperado en el cierre mensual", 500);
  }
});
