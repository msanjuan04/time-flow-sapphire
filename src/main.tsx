import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "next-themes";
import { initMonitoring } from "./lib/monitoring";
import { captureInstallPrompt, registerServiceWorker } from "./lib/pwa";

// Errores de producción → Sentry (solo si VITE_SENTRY_DSN está definido)
initMonitoring();

// App instalable y avisos de fichaje
captureInstallPrompt();
if (import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void registerServiceWorker();
  });
}

// Prevent noisy Vite ping requests when running a production build
// outside of the dev server (e.g., in hosted previews).
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  const originalFetch = window.fetch.bind(window);
  const extractAcceptHeader = (input: RequestInfo | URL, init?: RequestInit): string | null => {
    const fromInit = (() => {
      const headers = init?.headers;
      if (!headers) return null;
      if (headers instanceof Headers) return headers.get("accept");
      const key = Object.keys(headers).find((k) => k.toLowerCase() === "accept");
      return key ? (headers as Record<string, string>)[key] : null;
    })();

    if (fromInit) return fromInit;

    if (input instanceof Request) {
      return input.headers.get("accept");
    }

    return null;
  };

  window.fetch = (input, init) => {
    const acceptHeader = extractAcceptHeader(input, init);
    if (acceptHeader === "text/x-vite-ping") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return originalFetch(input as RequestInfo, init);
  };
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <App />
  </ThemeProvider>
);
