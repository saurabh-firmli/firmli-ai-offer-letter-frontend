import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import type { IAssessmentRun } from "./assessments";
import { INote } from "./notes";
import { IApiResponse, IOption, IPage } from "../types";

// The Manual Review Queue: each application the AI couldn't decide alone is a review case, which
// people assign, ask documents for, or return to the AI. Needs the Manual Review permission
// ("reviews"): read to see the queue, update for every action (even the two POSTs).

// waiting_documents: documents were requested; back to in_review as soon as one is uploaded.
export type TReviewStatus = "unassigned" | "assigned" | "in_review" | "waiting_documents" | "resolved";
export type TReviewPriority = "urgent" | "high" | "normal" | "low";
export type TResolution = "approved" | "rejected" | "returned_for_reassessment";
export type TEmailStatus = "sent" | "failed" | "not_configured";

export const reviewStatusColors: Record<TReviewStatus, string> = {
  unassigned: "orange",
  assigned: "primary",
  in_review: "violet",
  waiting_documents: "yellow",
  resolved: "green",
};

export const priorityColors: Record<TReviewPriority, string> = {
  urgent: "red",
  high: "orange",
  normal: "primary",
  low: "gray",
};

export interface IReviewOptions {
  statuses: IOption<TReviewStatus>[];
  resolutions: IOption<TResolution>[];
  priorities: IOption<TReviewPriority>[];
  flags: IOption[];
  reviewers: { id: number; name: string; email: string; roleName: string }[]; // who may work on reviews
}

export interface IReview {
  id: number;
  status: TReviewStatus;
  priority: TReviewPriority;
  reason: string | null;
  flags: { code: string; label: string }[];
  missingDocuments: number; // required documents without a file
  confidence: number | null; // 0 to 1
  queuedAt: string;
  queueSeconds: number; // time waiting; stops when resolved
  reviewer: { id: number; name: string } | null;
  assignedAt: string | null;
  resolution: TResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedBy: { id: number; name: string } | null;
  application: { id: number; applicationNumber: string; status: string };
  student: { id: number; name: string };
  program: { id: number; name: string };
  // Only on GET /reviews/:id
  studentEmail?: string;
  assignmentNote?: string | null;
  missingDocumentTypes?: { documentTypeId: number; label: string }[];
  documentRequests?: {
    id: number;
    documentTypeIds: number[];
    message: string | null;
    emailStatus: TEmailStatus;
    requestedBy: { id: number; name: string } | null;
    createdAt: string;
  }[];
  notes?: INote[]; // every note of the application, newest first
}

export interface IReviewFilters {
  page?: number;
  limit?: number;
  status?: TReviewStatus;
  priority?: TReviewPriority;
  reviewerId?: number;
  programId?: number;
  mine?: boolean; // only cases assigned to me
  search?: string;
}

/** The queue page, plus how many cases each status has (follows the other filters, not status). */
export type TReviewPage = IPage<IReview> & { counts: Record<TReviewStatus, number> };

/** 3628800 -> "42d 0h", 7500 -> "2h 5m", 300 -> "5m" */
export const formatQueueTime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export function useReviewOptions(enabled = true) {
  return useQuery({
    queryKey: ["reviews", "options"],
    queryFn: async () => (await api.get<IApiResponse<IReviewOptions>>("/reviews/options")).data.data,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useReviews(filters: IReviewFilters) {
  return useQuery({
    queryKey: ["reviews", "list", filters],
    queryFn: async () =>
      (await api.get<IApiResponse<TReviewPage>>("/reviews", { params: filters })).data.data,
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useReview(id: number | null) {
  return useQuery({
    queryKey: ["reviews", "detail", id],
    queryFn: async () => (await api.get<IApiResponse<IReview>>(`/reviews/${id}`)).data.data,
    enabled: Boolean(id),
  });
}

// Every action changes the case and its application (and the dashboard counts).
function useReviewAction<TInput>(request: (input: TInput) => Promise<{ data: IReview; message: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

const send = async (call: Promise<{ data: IApiResponse<IReview & { emailStatus?: TEmailStatus }> }>) => {
  const { data } = await call;
  return { data: data.data, message: data.message };
};

/** Assign or reassign: the case becomes assigned. A priority not sent stays as it is. */
export const useAssignReview = () =>
  useReviewAction(
    ({ id, ...body }: { id: number; reviewerId: number; priority?: TReviewPriority; note?: string }) =>
      send(api.put(`/reviews/${id}/assignment`, body))
  );

/**
 * Ask the student for documents. Recorded even when the email fails; the response's emailStatus and
 * message say whether the student was emailed. The case moves to in review.
 */
export const useRequestDocuments = () =>
  useReviewAction(({ id, ...body }: { id: number; documentTypeIds: number[]; message?: string }) =>
    send(api.post(`/reviews/${id}/request-documents`, body))
  );

/** Back to the AI: the case is resolved and the application is submitted again (pending). */
export const useReturnForReassessment = () =>
  useReviewAction(({ id, note }: { id: number; note?: string }) =>
    send(api.post(`/reviews/${id}/return-for-reassessment`, { note }))
  );

/**
 * Override a criterion of the latest completed run: met / not met with a note, or null to remove it.
 * It doesn't decide; the run comes back with suggestedOutcome for the decision.
 */
export function useOverrideCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      criterionId,
      ...body
    }: {
      reviewId: number;
      criterionId: number;
      result: "met" | "not_met" | null;
      note?: string;
    }) =>
      (await api.put<IApiResponse<IAssessmentRun>>(`/reviews/${reviewId}/criteria/${criterionId}`, body)).data
        .data,
    onSuccess: (run) => {
      queryClient.setQueryData(["applications", "assessment", run.applicationId], run);
      queryClient.invalidateQueries({ queryKey: ["applications", "activity"] });
    },
  });
}

/** Approve (conditional offer) or Reject, with a reason: resolves the case and completes the application. */
export const useReviewDecision = () =>
  useReviewAction(
    ({ id, ...body }: { id: number; outcome: "conditional_offer" | "rejection"; reason: string }) =>
      send(api.post(`/reviews/${id}/decision`, body))
  );
