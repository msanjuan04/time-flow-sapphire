import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
};

interface AdjustSessionRequest {
  session_id: string;
  clock_out_time: string;
  clock_in_time?: string;
  correction_reason?: string | null;
}

const parseIntervalToMs = (interval: unknown): number => {
  if (!interval || typeof interval !== "string") return 0;
  const match = interval.match(/^(-?\d+):(\d{2}):(\d{2})(\.\d+)?$/); // HH:MM:SS
  if (!match) return 0;
  const [, h, m, s] = match;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as AdjustSessionRequest;
    const { session_id, clock_out_time, clock_in_time, correction_reason } = payload;

    if (!session_id || !clock_out_time) {
      return new Response(JSON.stringify({ error: "session_id y clock_out_time son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("work_sessions")
      .select("id, user_id, company_id, clock_in_time, clock_out_time, total_pause_duration, total_work_duration, review_status, is_corrected")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Sesión no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("company_id", session.company_id)
      .eq("user_id", auth.user.id)
      .in("role", ["owner", "admin", "manager"])
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newClockIn = clock_in_time ?? session.clock_in_time;
    const newClockOut = clock_out_time;

    const start = new Date(newClockIn);
    const end = new Date(newClockOut);
    if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: "Fechas inválidas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (end <= start) {
      return new Response(JSON.stringify({ error: "La hora de salida debe ser posterior a la entrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pauseMs = parseIntervalToMs(session.total_pause_duration);
    const durationMs = Math.max(0, end.getTime() - start.getTime() - pauseMs);
    const totalWorkDuration = `${Math.floor(durationMs / 1000)} seconds`;
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("work_sessions")
      .update({
        clock_in_time: newClockIn,
        clock_out_time: newClockOut,
        total_work_duration: totalWorkDuration,
        is_active: false,
        status: "closed",
        review_status: "normal",
        is_corrected: true,
        corrected_by: auth.user.id,
        corrected_at: nowIso,
        correction_reason: correction_reason || null,
      })
      .eq("id", session.id);

    if (updateError) {
      console.error("Error updating session:", updateError);
      return new Response(JSON.stringify({ error: "No se pudo actualizar la sesión" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("time_entries_log").insert({
      time_entry_id: session.id,
      changed_by: auth.user.id,
      changed_at: nowIso,
      old_start_time: session.clock_in_time,
      old_end_time: session.clock_out_time,
      old_duration: session.total_work_duration,
      new_start_time: newClockIn,
      new_end_time: newClockOut,
      new_duration: totalWorkDuration,
      reason: correction_reason || null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error adjusting session:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
