import { useQuery } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse } from "../types";
import { RO_APPLICATIONS, RO_COMMUNICATIONS, RO_LETTERS, RO_MANUAL_REVIEW } from "../routes";

// What needs the user's attention, as counts (GET /notifications). Each item shows only for roles
// that may see its module. New codes may come; any item shows by its label.

export interface INotifications {
  total: number;
  items: { code: string; label: string; count: number }[];
}

// Refetched by lib/live.ts: after live events, every 60 seconds as a safety net, and once when a
// hidden tab comes back, all through one debounce so they never call twice.
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<IApiResponse<INotifications>>("/notifications")).data.data,
  });
}

/** Where an item opens: its list, already filtered. Unknown codes have nowhere to go yet. */
export const notificationLinks: Record<string, string> = {
  reviews_unassigned: `${RO_MANUAL_REVIEW}?status=unassigned`,
  reviews_assigned_to_me: `${RO_MANUAL_REVIEW}?mine=1`,
  letters_waiting: `${RO_LETTERS}?status=pending_approval`,
  emails_failed: `${RO_COMMUNICATIONS}?status=failed`,
  assessments_failed: `${RO_APPLICATIONS}?assessmentStatus=failed`,
  assessments_pending: `${RO_APPLICATIONS}?status=submitted`,
};
