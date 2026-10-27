import a, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, API_TIMEOUT } from "../config";
import { IApiResponse } from "../types";
import { getErrorCode, getErrorMessage, withJsonErrorBody } from "./errors";
import { getToken, setToken, signOut } from "./session";

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
  // The session cookie (httpOnly, sent to /auth/... only). The backend's CORS_ORIGINS must list
  // this app's exact address, or the browser sends no cookie and a session can't be refreshed.
  withCredentials: true,
});

// Every endpoint except health, login and the password reset ones needs the access token.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * A new access token from the session cookie. One refresh at a time: every request that got a 401
 * meanwhile waits for the same one. Rejects when the session is over (its error says why).
 */
let refreshing: Promise<string> | null = null;
export function refreshToken() {
  refreshing ??= api
    .post<IApiResponse<{ token: string }>>("/auth/refresh")
    .then(({ data }) => {
      setToken(data.data.token);
      return data.data.token;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Calls whose 401 is not an ended session to refresh: a wrong password (the login form shows it),
// logging out (the user is being logged out anyway), and the refresh itself (refreshToken() decides).
const isLoginRequest = (url = "") => /\/auth\/(login|logout|logout-all|refresh)$/.test(url);

/** Logs out and opens the login page, which says why. Decided by the error's code, never its text. */
function endSession(error: unknown) {
  const code = getErrorCode(error);
  if (code === "TENANT_BLOCKED") signOut("tenant_blocked");
  // The API's message names the status ("Your account is banned; contact your administrator").
  else if (code === "ACCOUNT_NOT_ACTIVE") signOut("inactive", getErrorMessage(error));
  else signOut("expired");
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // A file request gets its error as a blob: read it back to JSON so its code can be seen.
    await withJsonErrorBody(error);

    // Backend sends X-Request-Id on every response - log it so a failure can be traced in its logs.
    const requestId = error?.response?.headers?.["x-request-id"];
    if (requestId) {
      console.warn(
        `[api] ${error.config?.method?.toUpperCase()} ${error.config?.url} failed, request id: ${requestId}`
      );
    }

    const config = error.config as (InternalAxiosRequestConfig & { retried?: boolean }) | undefined;
    if (error?.response?.status !== 401 || !config || isLoginRequest(config.url))
      return Promise.reject(error);

    // The 15-minute access token ran out: get a new one once and send the request again.
    if (getErrorCode(error) === "SESSION_ENDED" && !config.retried) {
      try {
        await refreshToken();
      } catch (refreshError) {
        // The session is over (logout, password changed, blocked ...): its code says why. No answer
        // at all (offline, server down) is not an ended session: the request just fails.
        if (a.isAxiosError(refreshError) && refreshError.response) endSession(refreshError);
        return Promise.reject(error);
      }
      config.retried = true;
      return api(config);
    }

    endSession(error);
    return Promise.reject(error);
  }
);

export default api;
