import { queryClient } from "./queryClient";
import { RO_LOGIN } from "../routes";

const TOKEN_KEY = "token";
// The client user's token while Firmli staff are switched into it: this tab only, so the staff's
// other tabs (and any new one) keep their own login instead of becoming the client's user.
const SWITCHED_TOKEN_KEY = "switchedToken";

// localStorage can throw (private mode, blocked storage), so the token is also kept in memory.
const readStoredToken = () => {
  try {
    return sessionStorage.getItem(SWITCHED_TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

let token: string | null = readStoredToken();

/** The login token, sent by lib/api.ts as `Authorization: Bearer <token>`. Lasts 7 days. */
export const getToken = () => token;

export function setToken(value: string | null) {
  token = value;
  try {
    if (value && getStaffToken()) {
      sessionStorage.setItem(SWITCHED_TOKEN_KEY, value);
      return;
    }
    sessionStorage.removeItem(SWITCHED_TOKEN_KEY);
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the token lives in memory until the tab closes.
  }
}

const STAFF_TOKEN_KEY = "staffToken";

/**
 * Firmli staff who switched into a client's user keep their own token here (this tab only), for
 * the switch calls and Back to Firmli. null = not switched.
 */
export function getStaffToken() {
  try {
    return sessionStorage.getItem(STAFF_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStaffToken(value: string | null) {
  try {
    if (value) sessionStorage.setItem(STAFF_TOKEN_KEY, value);
    else sessionStorage.removeItem(STAFF_TOKEN_KEY);
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

// inactive: the user's status is no longer active (blocked, banned, ...); the API's message goes along.
// tenant_blocked: Firmli blocked the whole institution.
export type TSignOutReason = "logout" | "expired" | "inactive" | "tenant_blocked";

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
  setStaffToken(null); // logging out ends a staff switch too
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
