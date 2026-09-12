import { supabase } from "@/integrations/supabase/client";

/**
 * App instalable y avisos en el móvil.
 *
 * El trabajador de servicio (public/sw.js) permite instalar la app y
 * recibir los recordatorios de fichaje. La suscripción se guarda en el
 * servidor a través de la función push-register.
 */

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";

export const pushConfigured = () => VAPID_PUBLIC_KEY.length > 20;

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** La app está abierta como aplicación instalada, no en una pestaña. */
export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true);

export const isIos = () =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

const urlBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

let registration: ServiceWorkerRegistration | null = null;

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return registration;
  } catch (err) {
    console.error("No se pudo registrar el trabajador de servicio", err);
    return null;
  }
};

export const getSubscription = async (): Promise<PushSubscription | null> => {
  if (!pushSupported()) return null;
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) return null;
  return reg.pushManager.getSubscription();
};

export type PushState = "unsupported" | "unconfigured" | "denied" | "off" | "on";

export const getPushState = async (): Promise<PushState> => {
  if (!pushSupported()) return "unsupported";
  if (!pushConfigured()) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  return (await getSubscription()) ? "on" : "off";
};

/** Pide permiso, se suscribe y lo guarda en el servidor. */
export const enablePush = async (companyId?: string | null): Promise<PushState> => {
  if (!pushSupported()) return "unsupported";
  if (!pushConfigured()) return "unconfigured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  if (!reg) return "off";

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
    }));

  const raw = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { error } = await supabase.functions.invoke("push-register", {
    body: { action: "subscribe", company_id: companyId ?? null, subscription: raw },
  });
  if (error) {
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error("No se pudo activar el aviso en este dispositivo");
  }
  return "on";
};

export const disablePush = async (): Promise<PushState> => {
  const subscription = await getSubscription();
  if (!subscription) return "off";
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  await supabase.functions.invoke("push-register", { body: { action: "unsubscribe", endpoint } });
  return "off";
};

export const sendTestPush = async (): Promise<void> => {
  const { error } = await supabase.functions.invoke("push-register", { body: { action: "test" } });
  if (error) throw new Error("No se pudo enviar el aviso de prueba");
};

// ── Instalación ───────────────────────────────────────
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let installPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<(available: boolean) => void>();

export const captureInstallPrompt = () => {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    installListeners.forEach((listener) => listener(true));
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installListeners.forEach((listener) => listener(false));
  });
};

export const onInstallAvailability = (listener: (available: boolean) => void): (() => void) => {
  installListeners.add(listener);
  listener(installPrompt !== null);
  return () => {
    installListeners.delete(listener);
  };
};

export const promptInstall = async (): Promise<boolean> => {
  if (!installPrompt) return false;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  installPrompt = null;
  installListeners.forEach((listener) => listener(false));
  return choice.outcome === "accepted";
};
