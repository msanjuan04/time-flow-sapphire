import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";
import { handleCorsOptions, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { sendPushToAll } from "../_shared/webpush.ts";

/**
 * Alta y baja de un dispositivo para recibir avisos, y envío de prueba.
 *
 * El navegador se suscribe al servicio de notificaciones de su fabricante y
 * nos entrega un endpoint y dos claves. Eso es lo que se guarda. El
 * endpoint es sensible (quien lo tenga puede enviar avisos a ese móvil),
 * así que la tabla no es accesible desde el navegador.
 */

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
    const action: string = body?.action ?? "subscribe";

    if (action === "unsubscribe") {
      const endpoint: string = body?.endpoint;
      if (!endpoint) return createErrorResponse("Falta el endpoint", 400);
      await db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
      return createJsonResponse({ success: true });
    }

    if (action === "subscribe") {
      const endpoint: string = body?.subscription?.endpoint;
      const p256dh: string = body?.subscription?.keys?.p256dh;
      const auth: string = body?.subscription?.keys?.auth;
      const companyId: string | null = body?.company_id ?? null;
      if (!endpoint || !p256dh || !auth) return createErrorResponse("Suscripción incompleta", 400);

      const { error } = await db.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          company_id: companyId,
          endpoint,
          p256dh,
          auth,
          user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
      if (error) {
        console.error("push subscribe failed:", error);
        return createErrorResponse("No se pudo guardar el aviso", 500);
      }
      return createJsonResponse({ success: true });
    }

    if (action === "test") {
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", user.id);

      if (!subs?.length) return createErrorResponse("Este dispositivo no tiene los avisos activados", 400);

      const result = await sendPushToAll(subs, {
        title: "Avisos activados",
        body: "Así verás los recordatorios de fichaje.",
        url: "/me/clock",
        tag: "gtiq-test",
      });

      if (result.gone.length) {
        await db.from("push_subscriptions").delete().in("endpoint", result.gone);
      }
      if (result.sent === 0) {
        return createErrorResponse("No se pudo enviar el aviso de prueba", 502);
      }
      return createJsonResponse({ success: true, sent: result.sent });
    }

    return createErrorResponse("Acción no válida", 400);
  } catch (err) {
    console.error("push-register error:", err);
    return createErrorResponse("Error inesperado", 500);
  }
});
