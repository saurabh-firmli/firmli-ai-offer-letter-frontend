import a from "axios";
import { API_BASE_URL, API_TIMEOUT, DEV_TENANT_ID } from "../config";
import { signOut } from "./session";

/**
 * Shared axios instance for firmli-ai-offer-letter-backend.
 * Always import this one (`import api from "@/lib/api"`), never the bare package,
 * so base url, timeout and headers stay in one place.
 *
 * Tenancy: the backend takes the tenant only from the auth token (or, in dev, the
 * X-Tenant-Id header below). Never send tenantId / tenant_id in a body or query string.
 */
const api = a.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  // TODO(auth): send the auth token once the backend has auth, e.g.
  // const token = store.auth.authToken();
  // if (token) config.headers.Authorization = `Bearer ${token}`;

  // DEV ONLY, TEMPORARY. TODO(auth): remove this header (and VITE_DEV_TENANT_ID) once the
  // token above carries the tenantId claim.
  if (DEV_TENANT_ID) config.headers["X-Tenant-Id"] = DEV_TENANT_ID;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Backend sends X-Request-Id on every response - log it so a failure can be traced in its logs.
    const requestId = error?.response?.headers?.["x-request-id"];
    if (requestId && import.meta.env.DEV) {
      console.warn(
        `[api] ${error.config?.method?.toUpperCase()} ${error.config?.url} failed, request id: ${requestId}`
      );
    }

    // Any 401, including "Tenant could not be resolved.", ends the session.
    if (error?.response?.status === 401) signOut("unauthenticated");

    return Promise.reject(error);
  }
);

export default api;
