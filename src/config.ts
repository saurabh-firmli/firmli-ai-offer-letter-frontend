// Single place that reads import.meta.env. Everything else imports from here.
const getEnvVar = (name: keyof ImportMetaEnv, fallback = ""): string =>
  (import.meta.env[name] as string | undefined) || fallback;

export const SITE_NAME = getEnvVar("VITE_SITE_NAME", "Firmli AI Offer Letter");

// Base url of firmli-ai-offer-letter-backend, including the api version (…/v1)
export const API_BASE_URL = getEnvVar(
  "VITE_API_BASE_URL",
  "http://localhost:3000/v1"
).replace(/\/+$/, "");

export const API_TIMEOUT = Number(getEnvVar("VITE_API_TIMEOUT", "30000"));

// DEV ONLY, TEMPORARY: tenant uuid sent as X-Tenant-Id until backend auth exists.
// Empty means the header is not sent. The backend ignores it in production.
export const DEV_TENANT_ID = getEnvVar("VITE_DEV_TENANT_ID").trim();
