import { queryClient } from "./queryClient";
import { RO_LOGIN } from "../routes";

const TOKEN_KEY = "token";

// localStorage can throw (private mode, blocked storage), so the token is also kept in memory.
const readStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

let token: string | null = readStoredToken();

/**
 * The access token, sent by lib/api.ts as `Authorization: Bearer <token>`. It lasts 15 minutes; the
 * session cookie (httpOnly, 30 days) gets a new one (lib/api.ts refreshes on a 401). Read from storage
 * each time, so a token another tab just refreshed is used here too.
 */
export const getToken = () => readStoredToken() ?? token;

export function setToken(value: string | null) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the token lives in memory until the tab closes.
  }
}

// After a Firmli staff switch the browser's session (its cookie, every tab) is the client user's, and
// the API does not say so: the staff member's name is kept here for Back to Firmli.
const SWITCHED_KEY = "switchedFrom";

/** The Firmli staff member who switched into this user, or null. */
export function getSwitchedFrom() {
  try {
    return localStorage.getItem(SWITCHED_KEY);
  } catch {
    return null;
  }
}

export function setSwitchedFrom(staffName: string | null) {
  try {
    if (staffName) localStorage.setItem(SWITCHED_KEY, staffName);
    else localStorage.removeItem(SWITCHED_KEY);
  } catch {
    // Storage unavailable: Back to Firmli then means logging in again.
  }
}

/**
 * Drops every piece of client-side data, so one user's data can never show for another.
 * Call it on login, on logout and whenever the active user changes.
 * If anything starts keeping API data outside react-query (a store, localStorage, ...),
 * clear it here as well.
 */
export function clearSessionData() {
  void queryClient.cancelQueries();
  queryClient.clear();
}

// TODO(auth): when one user can belong to several companies (open product decision), the
// company picker shown after login goes here: on switch, get a new token for the chosen
// company, then call clearSessionData() before loading any of its data.

// logout: this device; logout_all: every device.
// inactive: the user's status is no longer active (blocked, banned, ...); the API's message goes along.
// tenant_blocked: Firmli blocked the whole institution.
export type TSignOutReason = "logout" | "logout_all" | "expired" | "inactive" | "tenant_blocked";

let signingOut = false;

// The API's own words for why the user was logged out, for the login page. Kept in this tab's
// storage, not the URL, so a shared link can't put its own text on the login page.
const SIGN_OUT_MESSAGE_KEY = "signOutMessage";

/** The message signOut() left for the login page, read once. */
export function takeSignOutMessage() {
  try {
    const message = sessionStorage.getItem(SIGN_OUT_MESSAGE_KEY);
    sessionStorage.removeItem(SIGN_OUT_MESSAGE_KEY);
    return message;
  } catch {
    return null;
  }
}

/** Drops the token and all client data, then opens the login page (lib/auth.ts logOut() calls the API first). */
export function signOut(reason: TSignOutReason, message?: string) {
  setToken(null);
  setSwitchedFrom(null); // logging out ends a staff switch too
  clearSessionData();

  if (signingOut || window.location.pathname === RO_LOGIN) return;
  signingOut = true;
  try {
    if (message) sessionStorage.setItem(SIGN_OUT_MESSAGE_KEY, message);
  } catch {
    // Storage unavailable: the login page shows its general text.
  }
  // An expired session comes back to the page it was on after logging in again (?next=).
  const { pathname, search } = window.location;
  const params = new URLSearchParams({
    reason,
    ...(reason === "expired" ? { next: pathname + search } : {}),
  });
  // A full page load, not a router navigation, so nothing held in memory survives.
  window.location.replace(`${RO_LOGIN}?${params}`);
}
