import { queryClient } from "./queryClient";
import { RO_SIGNED_OUT } from "../routes";

export type TSignOutReason = "logout" | "unauthenticated";

/**
 * Drops every piece of client-side data, so one tenant's data can never show for another.
 * Call it on logout and whenever the active user or tenant changes.
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

let signingOut = false;

/** Clears all client data and leaves the app for the signed-out page. */
export function signOut(reason: TSignOutReason) {
  clearSessionData();
  // TODO(auth): also drop the stored auth token here once backend auth lands.

  if (signingOut || window.location.pathname === RO_SIGNED_OUT) return;
  signingOut = true;
  // A full page load, not a router navigation, so nothing held in memory survives.
  window.location.replace(`${RO_SIGNED_OUT}?reason=${reason}`);
}
