// Single place that reads import.meta.env. Everything else imports from here.
const getEnvVar = (name: keyof ImportMetaEnv, fallback = ""): string =>
  (import.meta.env[name] as string | undefined) || fallback;

// Base url of firmli-ai-offer-letter-backend, including the api version (…/v1).
// The localhost default is for development only; a build without it fails (vite.config.mjs).
export const API_BASE_URL = getEnvVar(
  "VITE_API_BASE_URL",
  import.meta.env.DEV ? "http://localhost:5000/v1" : ""
).replace(/\/+$/, "");

export const API_TIMEOUT = Number(getEnvVar("VITE_API_TIMEOUT", "30000"));

// The product's name and the line under it (sidebar, login page, error pages). index.html has the
// same name in its <title>.
export const APP_NAME = "Firmli Admissions";
export const APP_TAGLINE = "AI Offer Letters";
