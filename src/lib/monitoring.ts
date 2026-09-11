import * as Sentry from "@sentry/react";

/**
 * Monitorización de errores en producción.
 *
 * Se activa solo si existe VITE_SENTRY_DSN. Sin DSN no hace nada, así que
 * en desarrollo y en entornos sin configurar no cambia el comportamiento.
 *
 * Qué captura: excepciones no controladas, promesas rechazadas sin catch,
 * errores de render (vía ErrorBoundary en App) y los `reportError` manuales.
 * Qué NO envía: códigos de acceso, emails ni cuerpos de peticiones. Ver
 * `beforeSend` para el filtrado.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = import.meta.env.VITE_APP_VERSION as string | undefined;

const SENSITIVE_KEYS = /code|login_code|password|token|secret|apikey|authorization|pin/i;

const scrub = (value: unknown, depth = 0): unknown => {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? "[filtrado]" : scrub(v, depth + 1);
  }
  return out;
};

export const monitoringEnabled = Boolean(DSN);

export const initMonitoring = () => {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        if (event.request.url) {
          // Los kioscos llevan el PIN y el código en la URL: no los enviamos.
          event.request.url = event.request.url.replace(/([?&](pin|device|code)=)[^&]+/gi, "$1[filtrado]");
          event.request.url = event.request.url.replace(/\/kiosk\/employee\/[^/?]+/i, "/kiosk/employee/[filtrado]");
        }
      }
      if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      return event;
    },
  });
};

/** Identifica al usuario en los informes de error (solo id y rol, nunca email). */
export const setMonitoringUser = (user: { id: string; role?: string | null; companyId?: string | null } | null) => {
  if (!DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id });
  Sentry.setTag("role", user.role ?? "unknown");
  if (user.companyId) Sentry.setTag("company_id", user.companyId);
};

/** Reporta un error controlado (catch) sin interrumpir al usuario. */
export const reportError = (error: unknown, context?: Record<string, unknown>) => {
  if (import.meta.env.DEV) console.error("[monitoring]", error, context);
  if (!DSN) return;
  Sentry.captureException(error, context ? { extra: scrub(context) as Record<string, unknown> } : undefined);
};

export const MonitoringErrorBoundary = Sentry.ErrorBoundary;
