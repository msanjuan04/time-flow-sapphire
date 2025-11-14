import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados; retention-cleanup funcionará en modo stub puro.");
}

const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

interface RetentionPayload {
  years?: number;
  dry_run?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  try {
    const body: RetentionPayload = await req.json().catch(() => ({}));
    const years = body.years && body.years > 0 ? body.years : 5;
    const dry_run = body.dry_run ?? true;

    const deleted = dry_run ? 0 : years * 10; // Stub: número ficticio
    const job_id = crypto.randomUUID();

    if (supabase) {
      const { error } = await supabase.from("retention_jobs").insert({
        id: job_id,
        run_at: new Date().toISOString(),
        dry_run,
        status: "done",
        deleted_count: deleted,
        log: `Stub: limpieza de ${years} años ${dry_run ? "(simulación)" : ""}`,
      });

      if (error) {
        console.error("Error registrando retention_job:", error);
        return createErrorResponse("No se pudo registrar el trabajo de retención", 500);
      }
    }

    return createJsonResponse({
      ok: true,
      deleted,
      job_id,
      dry_run,
    });
  } catch (error) {
    console.error("retention-cleanup error:", error);
    return createErrorResponse("Error inesperado en limpieza de retención", 500);
  }
});
