const normalizeUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/$/, "");
  }
  return `https://${trimmed.replace(/\/$/, "")}`;
};

const isUsableUrl = (value?: string | null, allowLocalhost = false) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  if (!allowLocalhost && normalized.includes("localhost")) return null;
  return normalized;
};

const FALLBACK_PRODUCTION_URL = "https://gneraitiq.com";

const getEnv = (key: string) => {
  const denoEnv = (globalThis as { Deno?: { env: { get(name: string): string | undefined } } }).Deno
    ?.env;
  return denoEnv?.get(key) ?? undefined;
};

export const resolveSiteUrl = (req?: Request, allowLocalhost = false) => {
  const protoHeader = req?.headers.get("x-forwarded-proto") || (allowLocalhost ? "http" : "https");
  const forwardedHost = req?.headers.get("x-forwarded-host");
  const headerHostUrl = forwardedHost ? `${protoHeader}://${forwardedHost}` : null;

  const candidates = [
    getEnv("SITE_URL"),
    getEnv("PUBLIC_SITE_URL"),
    getEnv("FRONTEND_URL"),
    getEnv("APP_URL"),
    getEnv("DEFAULT_SITE_URL"),
    req?.headers.get("origin"),
    headerHostUrl,
  ];

  // First try without localhost
  for (const candidate of candidates) {
    const usable = isUsableUrl(candidate, false);
    if (usable) {
      return usable;
    }
  }

  // If allowLocalhost and no production URL found, try with localhost
  if (allowLocalhost) {
    for (const candidate of candidates) {
      const usable = isUsableUrl(candidate, true);
      if (usable) {
        return usable;
      }
    }
    // Last resort: use localhost
    return "http://localhost:8081";
  }

  return FALLBACK_PRODUCTION_URL;
};


