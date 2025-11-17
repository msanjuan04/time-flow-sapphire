import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "next-themes";

// Avoid loading duplicated presence scripts injected by external tooling (e.g., lovable-tagger)
const guardPresenceScript = () => {
  if (typeof window === "undefined") return;
  if ((window as Record<string, unknown>).__presenceScriptGuarded) return;

  const mark = "__presenceScriptGuarded";
  Object.defineProperty(window as Record<string, unknown>, mark, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  const seen = new Set<string>();
  const shouldSkip = (script: HTMLScriptElement | null): boolean => {
    if (!script || script.tagName !== "SCRIPT") return false;
    const src = script.src || script.getAttribute("src") || "";
    if (!src.toLowerCase().includes("presence.js")) return false;
    if (seen.has(src)) {
      console.warn("[presence] Ignoring duplicate script injection:", src);
      return true;
    }
    seen.add(src);
    return false;
  };

  // Wrap methods that can inject scripts
  const wrap = <T extends Element>(fn: (...args: any[]) => T) => {
    return function patched(this: Element, ...args: any[]): T {
      const candidate = args[0] as Element | null;
      if (shouldSkip(candidate as HTMLScriptElement)) {
        return candidate as T;
      }
      return fn.apply(this, args);
    };
  };

  // Intercept common DOM manipulation methods
  Element.prototype.appendChild = wrap(Element.prototype.appendChild);
  Element.prototype.insertBefore = wrap(Element.prototype.insertBefore);
  Element.prototype.replaceChild = wrap(Element.prototype.replaceChild);
  
  // Also intercept insertAdjacentElement which might be used
  const originalInsertAdjacentElement = Element.prototype.insertAdjacentElement;
  Element.prototype.insertAdjacentElement = function(
    position: InsertPosition,
    element: Element
  ): Element | null {
    if (shouldSkip(element as HTMLScriptElement)) {
      return element;
    }
    return originalInsertAdjacentElement.call(this, position, element);
  };
};

guardPresenceScript();

if (import.meta.env.DEV) {
  console.log("SUPERADMIN_CODE:", "739421");
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

// Inject manifest only when not running on Lovable preview to avoid CORS
try {
  const host = window.location.hostname;
  if (!host.includes("preview--")) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest.webmanifest";
    document.head.appendChild(link);
  }
} catch {}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <App />
  </ThemeProvider>
);
