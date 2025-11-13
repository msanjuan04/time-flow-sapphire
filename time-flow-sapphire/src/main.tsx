import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "next-themes";

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
