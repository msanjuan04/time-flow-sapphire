import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "next-themes";

// Avoid loading duplicated presence scripts injected by external tooling
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
  const shouldSkip = (script: HTMLScriptElement) => {
    const src = script.src || script.getAttribute("src") || "";
    if (!src.toLowerCase().includes("presence.js")) return false;
    if (seen.has(src)) {
      console.warn("[presence] Ignoring duplicate script injection:", src);
      return true;
    }
    seen.add(src);
    return false;
  };

  const wrap = <T extends Element>(fn: (...args: any[]) => T) => {
    return function patched(this: Element, ...args: any[]): T {
      const candidate = args[0] as Element | null;
      if (candidate && candidate.tagName === "SCRIPT" && shouldSkip(candidate as HTMLScriptElement)) {
        return candidate as T;
      }
      return fn.apply(this, args);
    };
  };

  Element.prototype.appendChild = wrap(Element.prototype.appendChild);
  Element.prototype.insertBefore = wrap(Element.prototype.insertBefore);
};

guardPresenceScript();

if (import.meta.env.DEV) {
  console.log("SUPERADMIN_CODE:", "739421");
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
