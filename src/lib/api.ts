import a from "axios";
import { API_BASE_URL, API_TIMEOUT } from "../config";
import { getErrorCode, getErrorMessage } from "./errors";
import { getStaffToken, getToken, signOut } from "./session";

/**
 * Shared axios instance for firmli-ai-offer-letter-backend.
 * Always import this one (`import api from "@/lib/api"`), never the bare package,
 * so base url, timeout and headers stay in one place.
 */
const api = a.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  // No default Content-Type: axios adds application/json only when there is a body,
  // so plain GETs skip the CORS preflight.
  headers: { Accept: "application/json" },
});

// Firmli staff calls (switch tenant / user, Platform Admin) and logout go with the staff token while
// switched into a client's user, so the client's own sessions are never touched.
const isStaffRequest = (url = "") => /^\/?(platform|dev)\//.test(url) || /\/auth\/logout$/.test(url);

// Every endpoint except health and login needs the login token.
api.interceptors.request.use((config) => {
  const token = (isStaffRequest(config.url) && getStaffToken()) || getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A wrong password also answers 401; the login form shows that one itself. A logout with a token
// that already stopped working is fine too: the user is being logged out anyway.
const isLoginRequest = (url = "") => /\/auth\/(login|logout)$/.test(url);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Backend sends X-Request-Id on every response - log it so a failure can be traced in its logs.
    const requestId = error?.response?.headers?.["x-request-id"];
    if (requestId) {
      console.warn(
        `[api] ${error.config?.method?.toUpperCase()} ${error.config?.url} failed, request id: ${requestId}`
      );
    }

    // Token missing, invalid or expired, the institution blocked, or the user no longer active: log
    // out and go to the login page, which says why. Decided by the error's code, never its text.
    if (error?.response?.status === 401 && !isLoginRequest(error.config?.url)) {
      const code = getErrorCode(error);
      if (code === "TENANT_BLOCKED") signOut("tenant_blocked");
      // The API's message names the status ("Your account is banned; contact your administrator").
      else if (code === "ACCOUNT_NOT_ACTIVE") signOut("inactive", getErrorMessage(error));
      else signOut("expired");
    }

    return Promise.reject(error);
  }
);

export default api;
