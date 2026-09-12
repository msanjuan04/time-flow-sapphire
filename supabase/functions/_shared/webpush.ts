import webpush from "npm:web-push@3.6.7";

/**
 * Envío de avisos al móvil (Web Push).
 *
 * Las claves VAPID identifican a GTiQ ante el servicio de notificaciones
 * del navegador. La pública viaja al navegador; la privada vive solo como
 * secreto del proyecto.
 */

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta a la que lleva el aviso al tocarlo. */
  url?: string;
  tag?: string;
}

let configured = false;

/** Devuelve false si el proyecto todavía no tiene claves configuradas. */
export const configureWebPush = (): boolean => {
  if (configured) return true;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:soporte@gneraitiq.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
};

export interface PushResult {
  sent: number;
  gone: string[];
  failed: number;
}

/**
 * Envía un aviso a varios dispositivos. Devuelve los endpoints que el
 * servicio da por muertos (404 o 410) para poder borrarlos.
 */
export const sendPushToAll = async (
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<PushResult> => {
  const result: PushResult = { sent: 0, gone: [], failed: 0 };
  if (!configureWebPush() || subscriptions.length === 0) return result;

  const body = JSON.stringify(payload);
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 600 },
        );
        result.sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          result.gone.push(sub.endpoint);
        } else {
          result.failed += 1;
          console.error("push failed", status, (err as Error)?.message);
        }
      }
    }),
  );

  return result;
};
