import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { isLiveConnected } from "./live";
import { TOutcome } from "./applications";
import { TDataType, TOperator } from "./eligibility";
import { IApiResponse } from "../types";

// AI Assessment: the AI reads every document of a submitted application, finds the applicant's value
// for each criterion, and the backend decides with the Settings rules. Running needs Applications
// create; reading needs read. A run takes about 10–60 seconds in the background
// (a job queue); longer when many are queued or the AI is busy, retried for a few minutes before it fails.

export type TRunStatus = "in_progress" | "completed" | "failed";
export type TCriterionResult = "met" | "not_met" | "unclear";

export const criterionResultColors: Record<TCriterionResult, string> = {
  met: "green",
  not_met: "red",
  unclear: "orange",
};

export const criterionResultLabels: Record<TCriterionResult, string> = {
  met: "Met",
  not_met: "Not met",
  unclear: "Unclear",
};

export interface IAssessmentCriterion {
  criterionId: number;
  name: string;
  isMandatory: boolean; // only mandatory criteria decide
  result: TCriterionResult;
  foundValue: string | null; // what the AI found for the applicant, e.g. "3.62"
  operator: TOperator;
  requiredValue: string;
  unit: string | null;
  dataType: TDataType;
  evidence: string | null; // e.g. Page 1: "Cumulative GPA: 3.62 / 4.00"
  sourceDocumentId: number | null;
  confidence: number | null; // 0 to 1
  reasoning: string | null;
  // A reviewer's own result (Manual Review), next to the AI's; finalResult is the one that counts.
  override: {
    result: "met" | "not_met";
    note: string;
    by: { id: number; name: string } | null;
    at: string;
  } | null;
  finalResult: TCriterionResult;
}

export interface IAssessmentDocument {
  documentId: number;
  originalName: string;
  documentType: string; // the declared type
  status: "completed" | "unsupported" | "failed";
  detectedType: string | null;
  typeMatches: boolean | null; // null when "Verify document type" is off
  confidence: number | null;
  modelCode: string | null;
  // null when the document could not be read (failed / unsupported)
  fields: { name: string; value: string; confidence: number | null; evidence: string | null }[] | null;
  errorMessage: string | null;
}

/** One run, newest summary fields first; the full run adds the per-criterion and per-document results. */
export interface IAssessmentRunSummary {
  id: number;
  status: TRunStatus;
  outcome: TOutcome | null;
  confidence: number | null;
  startedAt: string;
  completedAt: string | null;
  costUsd: number | null; // null until model prices are set
}

export interface IAssessmentRun extends IAssessmentRunSummary {
  applicationId: number;
  summary: string | null; // e.g. "All 2 mandatory criteria met"
  flags: { code: string; label: string }[]; // same codes as the review queue
  escalated: boolean; // the escalation model checked it again
  errorMessage: string | null; // why a run failed
  eligibilityVersion: number | null;
  tokens: number | null;
  triggeredBy: { id: number; name: string } | null; // null = ran automatically
  criteria: IAssessmentCriterion[];
  documents: IAssessmentDocument[];
  suggestedOutcome: TOutcome | null; // what the mandatory criteria say, with the overrides
}

// While a run is going: the live assessment.updated event (lib/live.ts) refetches it at once; this
// slow poll is only the safety net when the stream is down.
const POLL_MS = 10_000;

/** The latest run (null if never assessed); checks again every few seconds while it runs. */
export function useLatestAssessment(applicationId: number | null, running = false) {
  return useQuery({
    queryKey: ["applications", "assessment", applicationId],
    queryFn: async () =>
      (await api.get<IApiResponse<IAssessmentRun | null>>(`/applications/${applicationId}/assessment`)).data
        .data,
    enabled: Boolean(applicationId),
    refetchInterval: (query) =>
      !isLiveConnected() && (running || query.state.data?.status === "in_progress") ? POLL_MS : false,
  });
}

/** Every run of an application, newest first. */
export function useAssessmentRuns(applicationId: number | null) {
  return useQuery({
    queryKey: ["applications", "assessments", applicationId],
    queryFn: async () =>
      (await api.get<IApiResponse<IAssessmentRunSummary[]>>(`/applications/${applicationId}/assessments`))
        .data.data,
    enabled: Boolean(applicationId),
  });
}

/** One earlier run, with all its results. */
export function useAssessmentRun(runId: number | null) {
  return useQuery({
    queryKey: ["applications", "assessment-run", runId],
    queryFn: async () =>
      (await api.get<IApiResponse<IAssessmentRun>>(`/applications/assessments/${runId}`)).data.data,
    enabled: Boolean(runId),
  });
}

/** Run Assessment: the API answers 202 at once and the run goes on in the background. */
export function useRunAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: number) =>
      (await api.post<IApiResponse<unknown>>(`/applications/${applicationId}/assess`)).data,
    // The application now shows processing / in progress; the run is picked up by polling.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
