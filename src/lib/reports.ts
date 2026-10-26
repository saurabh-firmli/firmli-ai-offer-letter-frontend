import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import api from "./api";
import { TOutcome } from "./applications";
import { withJsonErrorBody } from "./errors";
import { IApiResponse } from "../types";

// The Reports page: KPIs and charts of the applications submitted in a period, and a CSV of them.
// Needs Applications read, like the dashboard. Rates are 0 to 1, null when there are no applications.

export interface IReportFilters {
  from?: string; // YYYY-MM-DD, both days included; none = all time
  to?: string;
  programId?: number;
}

export interface IReport {
  kpis: {
    totalApplications: number;
    conditionalOffers: number;
    rejections: number;
    manualReviews: number;
    inProgress: number; // submitted or being assessed
    assessmentCompletionRate: number | null;
    avgConfidence: number | null;
    documentCompletionRate: number | null;
    avgProcessingSeconds: number | null; // of an AI run
    manualDecisions: number; // outcomes set by a person
    emailsSent: number; // emails to these students that went out, every type
  };
  charts: {
    overTime: {
      date: string;
      submitted: number;
      conditionalOffers: number;
      rejections: number;
      manualReviews: number;
    }[];
    outcomes: { value: TOutcome; label: string; count: number }[];
    programs: {
      id: number;
      code: string;
      name: string;
      total: number;
      conditionalOffers: number;
      rejections: number;
      manualReviews: number;
      assessed: number;
      offerRate: number | null;
    }[];
    assessments: { date: string; completed: number; failed: number; avgSeconds: number | null }[];
  };
}

const utcOffset = () => -new Date().getTimezoneOffset();

export function useReport(filters: IReportFilters) {
  return useQuery({
    queryKey: ["reports", filters],
    queryFn: async () =>
      (await api.get<IApiResponse<IReport>>("/reports", { params: { ...filters, utcOffset: utcOffset() } }))
        .data.data,
    placeholderData: keepPreviousData,
  });
}

/**
 * Export CSV: the file needs the token, so it comes through the API client as a blob and is saved
 * from memory. Errors come back as JSON, like every other call.
 */
export async function downloadReportCsv(filters: IReportFilters) {
  try {
    const { data } = await api.get<Blob>("/reports/export", {
      params: { ...filters, utcOffset: utcOffset() },
      responseType: "blob",
      timeout: 0, // up to 50,000 rows
    });
    const url = URL.createObjectURL(data);
    Object.assign(document.createElement("a"), {
      href: url,
      download: `applications-${dayjs().format("YYYY-MM-DD")}.csv`,
    }).click();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}
