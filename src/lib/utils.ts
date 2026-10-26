import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Part of dayjs itself (no extra package): "5 minutes ago".
dayjs.extend(relativeTime);

/** Select / SegmentedControl options from a { value: label } map. */
export const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** Select options from API records; Select values are strings, so ids go back with Number(). */
export const toIdOptions = (items: { id: number; name: string }[] = []) =>
  items.map((item) => ({ value: String(item.id), label: item.name }));

/** "2026-12-31" or an ISO timestamp -> "31 Dec 2026"; empty -> "—". */
export const formatDate = (date: string | null | undefined) =>
  date ? dayjs(date).format("DD MMM YYYY") : "—";

/** A moment (createdAt / updatedAt) in the browser's time zone: "23 Oct 2026, 1:05 PM". */
/** A date as the API takes it: YYYY-MM-DD, the local day. Empty stays null. */
export function toApiDate(date: Date | string): string;
export function toApiDate(date: Date | string | null | undefined): string | null;
export function toApiDate(date: Date | string | null | undefined) {
  return date ? dayjs(date).format("YYYY-MM-DD") : null;
}

export const formatDateTime = (date: string | null | undefined) =>
  date ? dayjs(date).format("DD MMM YYYY, h:mm A") : "—";

/** How long ago, for feeds: "5 minutes ago", "2 days ago". Pair it with formatDateTime in a tooltip. */
export const formatRelative = (date: string) => dayjs(date).fromNow();

/** How long since, without "ago": "5 hours", "a day" (e.g. "Waiting 5 hours"). */
export const formatSince = (date: string) => dayjs(date).fromNow(true);

export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

/**
 * A phone number with its country code (+ or 00), as the API takes it: spaces, - ( ) and . may sit
 * between the digits; the API saves it as E.164 (+919876543210), at most 15 digits.
 */
export const isPhone = (value: string) => /^(\+|00)\d{6,15}$/.test(value.replace(/[\s\-().]/g, ""));
export const PHONE_ERROR = "Enter the number with its country code, e.g. +919876543210";
export const PHONE_HINT = "With the country code, e.g. +91 98765 43210";

/**
 * Opens a link that has to be fetched first (a short-lived link shown inline, e.g. a PDF) in a new
 * tab. The tab opens at once, still inside the click, so the browser doesn't block it as a popup
 * after the wait; it closes again if the link can't be had. For a download use downloadFetchedUrl.
 */
export async function openFetchedUrl(getUrl: () => Promise<string>) {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await getUrl();
    if (tab) tab.location.href = url;
    else window.open(url, "_blank", "noopener");
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/**
 * Downloads a file whose link has to be fetched first (a short-lived link that answers as an
 * attachment). The link is followed on this page: the browser saves the file and stays here, so no
 * tab opens (none left blank, none blocked as a popup).
 */
export async function downloadFetchedUrl(getUrl: () => Promise<string>) {
  const link = document.createElement("a");
  link.href = await getUrl();
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
