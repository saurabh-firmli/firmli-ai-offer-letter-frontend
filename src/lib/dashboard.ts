import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "./api";
import { TApplicationStatus, TAssessmentStatus, TOutcome } from "./applications";
import { IApiResponse } from "../types";

// Everything on the Dashboard in one call. Needs Applications read. Counts that aren't built yet
// (letters, emails, processing time) come as null: show "—", never 0.

export interface IDashboardFilters {
  from?: string; // YYYY-MM-DD, both days included, at most 366 days
  to?: string;
  programId?: number;
}

export type TAttentionReason = "manualReview" | "assessmentFailed" | "missingDocuments";

export interface IDashboard {
  stats: {
    totalApplications: number; // submitted in the period; drafts are separate
    drafts: number;
    receivedToday: number; // whatever the period
    pendingAssessments: number;
    conditionalOffers: number;
    rejections: number;
    manualReview: number;
    missingDocuments: number;
    unassigned: number;
    lettersWaiting: number | null;
    emailsSent: number | null;
    failedEmails: number | null;
    avgProcessingSeconds: number | null;
  };
  rates: { assessed: number; offer: number | null; rejection: number | null; manualReview: number | null };
  statuses: { value: TApplicationStatus; label: string; count: number }[];
  outcomes: { value: TOutcome; label: string; count: number }[];
  programs: { id: number; name: string; code: string; count: number }[];
  trend: { date: string; count: number }[];
  recentApplications: {
    id: number;
    applicationNumber: string;
    studentName: string;
    programName: string;
    status: TApplicationStatus;
    assessmentStatus: TAssessmentStatus | null;
    outcome: TOutcome | null;
    submittedAt: string;
  }[];
  attention: {
    total: number;
    items: {
      id: number;
      applicationNumber: string;
      studentName: string;
      programName: string;
      since: string;
      reasons: { code: TAttentionReason; label: string }[];
    }[];
  };
  activity: {
    type: "created" | "submitted" | "document_uploaded" | string;
    label: string;
    applicationId: number;
    applicationNumber: string;
    userName: string | null;
    at: string;
  }[];
}

export function useDashboard(filters: IDashboardFilters) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: async () =>
      (
        await api.get<IApiResponse<IDashboard>>("/dashboard", {
          // The viewer's offset, so "today" and the trend days are their days (India: 330).
          params: { ...filters, utcOffset: -new Date().getTimezoneOffset() },
        })
      ).data.data,
    placeholderData: keepPreviousData,
  });
}

/** 81 -> "1m 21s"; null (not tracked yet) -> "—". */
export const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours) return `${hours}h ${minutes % 60}m`;
  return minutes ? `${minutes}m ${Math.round(seconds % 60)}s` : `${Math.round(seconds)}s`;
};

/** A share from 0 to 1 as a percentage; null (nothing assessed yet) -> "—". */
export const formatRate = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);
