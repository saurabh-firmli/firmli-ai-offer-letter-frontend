import { useEffect } from "react";
import api from "./api";
import { queryClient } from "./queryClient";
import { API_BASE_URL } from "../config";
import { IApiResponse } from "../types";

// Live updates: one Server-Sent Events stream for the whole app (opened in the layout after login).
// Events carry ids and statuses only; on each one the matching react-query data is refetched with
// the normal endpoints, so nothing shows that the user may not see. EventSource can't send the
// token, so each (re)connect first asks for a 60-second ticket.

// Each event and the react-query key prefixes it changes; the bell and the dashboard on every one.
const REFRESH = {
  "assessment.updated": ["applications", "reviews", "reports"],
  "review.updated": ["reviews", "applications"],
  "letter.updated": ["letters", "applications"],
  "email.updated": ["emails", "letters", "applications"],
};
const ALWAYS = ["dashboard", "notifications"];

const RETRY_MS = 5_000;
// Every open tab of every user of the institution gets every event, and they come in bursts (dozens
// for a batch of submissions). So refetch once, after a quiet second, plus up to a second at random
// so the tabs don't all call the API at the same moment.
const QUIET_MS = 1_000;
const SPREAD_MS = 1_000;
// The bell's safety net (events missed while the stream was down), through the same debounce so a
// poll and an event don't both call.
const BELL_POLL_MS = 60_000;

let source: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let batchTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let pending = new Set<string>();
let missed = false; // due while the tab was hidden: refetch once it is visible again
let dropped = false; // the stream went down: refetch the open page once it is back
let running = false;
let connected = false;
let generation = 0; // bumped by stop(), so a connect() still waiting for its ticket gives up

/** True while the stream is open; a running assessment is polled only when it isn't. */
export const isLiveConnected = () => connected;

// Dropdown values (".../options") don't change with an event: leave them cached.
const notOptions = ({ queryKey }: { queryKey: readonly unknown[] }) => !queryKey.includes("options");

/**
 * Refetches what changed, once, after the events stop. Only what is on screen refetches (react-query
 * refetches active queries; the rest are just marked stale), and a hidden tab waits until it is
 * visible again. A fetch already running is reused, not restarted.
 */
function flush() {
  if (document.visibilityState === "hidden") {
    missed = true;
    return;
  }
  const due = pending;
  pending = new Set();
  due.forEach(
    (key) =>
      void queryClient.invalidateQueries({ queryKey: [key], predicate: notOptions }, { cancelRefetch: false })
  );
}

function refresh(keys: string[]) {
  keys.forEach((key) => pending.add(key));
  clearTimeout(batchTimer);
  batchTimer = setTimeout(flush, QUIET_MS + Math.random() * SPREAD_MS);
}

function onVisible() {
  if (document.visibilityState === "visible" && missed) {
    missed = false;
    flush();
  }
}

async function connect() {
  clearTimeout(retryTimer);
  if (!running) return;
  // A stop() (and maybe a new start()) while the ticket was on its way makes this call stale.
  const run = generation;
  let stream: EventSource;
  try {
    const { data } = await api.post<IApiResponse<{ ticket: string; expiresIn: number }>>("/events/ticket");
    if (!running || run !== generation) return;
    stream = new EventSource(`${API_BASE_URL}/events?ticket=${encodeURIComponent(data.data.ticket)}`);
    source = stream;
  } catch {
    if (run !== generation) return;
    // Logged out (the API client already handles 401) or the server is down: try again later.
    retryTimer = setTimeout(connect, RETRY_MS * 2);
    return;
  }
  stream.addEventListener("ready", () => {
    connected = true;
    // Events sent while the stream was down are not replayed: refetch what they would have, the
    // same way as an event (so a letter's PDF being read, "letter-pdf", doesn't reload).
    if (dropped) refresh([...Object.values(REFRESH).flat(), ...ALWAYS]);
    dropped = false;
  });
  Object.entries(REFRESH).forEach(([name, keys]) =>
    stream.addEventListener(name, () => refresh([...keys, ...ALWAYS]))
  );
  // The ticket in the URL is used up, so EventSource's own reconnect can't work: close and start over.
  stream.onerror = () => {
    stream.close();
    if (source !== stream) return; // an older stream: leave the current one alone
    source = null;
    // A running assessment polls only while the stream is down (lib/assessments.ts), and react-query
    // re-reads refetchInterval only after a fetch: refetch it once so its poll starts now.
    if (connected) void queryClient.invalidateQueries({ queryKey: ["applications", "assessment"] });
    connected = false;
    dropped = true;
    retryTimer = setTimeout(connect, RETRY_MS);
  };
}

export const live = {
  start() {
    if (running) return;
    running = true;
    document.addEventListener("visibilitychange", onVisible);
    pollTimer = setInterval(() => refresh(["notifications"]), BELL_POLL_MS);
    void connect();
  },
  /** Before the token goes (logout), so no new ticket is asked for. */
  stop() {
    running = false;
    generation += 1;
    connected = false;
    clearTimeout(retryTimer);
    clearTimeout(batchTimer);
    clearInterval(pollTimer);
    document.removeEventListener("visibilitychange", onVisible);
    pending = new Set();
    missed = false;
    source?.close();
    source = null;
  },
};

/** Keeps the stream open while a user is logged in (the app layout). */
export function useLiveUpdates(userId: number | undefined) {
  useEffect(() => {
    if (!userId) return;
    live.start();
    return () => live.stop();
  }, [userId]);
}
