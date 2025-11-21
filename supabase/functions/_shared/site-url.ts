const normalizeUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/$/, "");
  }
  return `https://${trimmed.replace(/\/$/, "")}`;
};

const isUsableUrl = (value?: string | null) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  if (normalized.includes("localhost")) return null;
  return normalized;
};

const FALLBACK_PRODUCTION_URL = "https://gneraitiq.com";

const getEnv = (key: string) => {
  const denoEnv = (globalThis as { Deno?: { env: { get(name: string): string | undefined } } }).Deno
    ?.env;
  return denoEnv?.get(key) ?? undefined;
};

export const resolveSiteUrl = (req?: Request) => {
  const protoHeader = req?.headers.get("x-forwarded-proto") || "https";
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

  for (const candidate of candidates) {
    const usable = isUsableUrl(candidate);
    if (usable) {
      return usable;
    }
  }

  return FALLBACK_PRODUCTION_URL;
};

