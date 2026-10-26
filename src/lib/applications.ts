import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import type { IAssessmentDocument } from "./assessments";
import type { ILetterSummary } from "./letters";
import { IApiResponse, IOption, IPage } from "../types";
import { TStudyMode } from "./programs";
import { downloadFetchedUrl } from "./utils";

// A student's application to a program for an intake. A draft can be edited, get documents or be
// deleted; after submit it is locked (the API answers 409). Needs the Applications permission.

export type TApplicationStatus = "draft" | "submitted" | "processing" | "manual_review" | "completed";
export type TAssessmentStatus = "pending" | "in_progress" | "completed" | "failed";
export type TOutcome = "conditional_offer" | "rejection" | "manual_review";
export type TGender = "male" | "female" | "other" | "prefer_not_to_say";

// Badge colors; the labels come from GET /applications/options.
export const applicationStatusColors: Record<TApplicationStatus, string> = {
  draft: "gray",
  submitted: "primary",
  processing: "violet",
  manual_review: "orange",
  completed: "green",
};

export const assessmentStatusColors: Record<TAssessmentStatus, string> = {
  pending: "gray",
  in_progress: "primary",
  completed: "green",
  failed: "red",
};

export const outcomeColors: Record<TOutcome, string> = {
  conditional_offer: "green",
  rejection: "red",
  manual_review: "orange",
};

export interface IApplicationOptions {
  intakes: { term: string; year: number; label: string }[];
  genders: IOption<TGender>[];
  studyModes: IOption<TStudyMode>[];
  statuses: IOption<TApplicationStatus>[];
  assessmentStatuses: IOption<TAssessmentStatus>[];
  outcomes: IOption<TOutcome>[];
  officers: { id: number; name: string; email: string; roleName: string }[];
  upload: { maxSizeMb: number; extensions: string[] };
}

export interface IStudent {
  id: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: TGender | null;
  nationality: { id: number; name: string } | null;
  residenceCountry: { id: number; name: string } | null;
  passportNumber: string | null;
  email: string;
  phone: string | null;
  address: string | null;
}

export interface IApplicationDocument {
  id: number;
  documentTypeId: number;
  documentType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: number; name: string } | null;
  createdAt: string;
}

export interface IDocumentRequirement {
  documentTypeId: number;
  documentType: string;
  customLabel: string | null;
  instructions: string | null;
  isRequired: boolean;
  documents: IApplicationDocument[];
}

export interface IApplication {
  id: number;
  applicationNumber: string; // "APP-49975668", the App #
  status: TApplicationStatus;
  assessmentStatus: TAssessmentStatus | null;
  outcome: TOutcome | null;
  confidence: number | null; // 0 to 1
  // Who decided the outcome: the AI, or a person with a reason; null while nothing is decided.
  decision: {
    source: "ai" | "manual";
    by: { id: number; name: string } | null;
    at: string | null;
    reason: string | null;
  } | null;
  letter: ILetterSummary | null; // the current letter (the newest not replaced)
  student: IStudent;
  program: { id: number; name: string; code: string };
  intakeTerm: string;
  intakeYear: number;
  intake: string; // "Fall 2026"
  studyMode: TStudyMode;
  applicationDate: string;
  documentCount: number;
  // The criteria version that applies; locked on submit. null = the program has none published.
  eligibilityVersion: { id: number; versionNumber: number; locked: boolean } | null;
  officer: { id: number; name: string } | null;
  submittedAt: string | null;
  submittedBy: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
  // Only on GET /applications/:id
  documentRequirements?: IDocumentRequirement[];
  otherDocuments?: IApplicationDocument[];
  missingDocuments?: string[];
}

export interface IStudentInput {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string | null; // YYYY-MM-DD
  gender: TGender | null;
  nationalityId: number | null;
  residenceCountryId: number | null;
  passportNumber: string;
  email: string;
  phone: string;
  address: string;
}

export interface IApplicationInput {
  student: Partial<IStudentInput>;
  programId: number;
  intakeTerm: string;
  intakeYear: number;
  studyMode?: TStudyMode;
  applicationDate?: string;
}

export interface IApplicationFilters {
  page?: number;
  limit?: number;
  search?: string;
  programId?: number;
  status?: TApplicationStatus;
  outcome?: TOutcome;
  letterStatus?: TLetterFilter;
  assessmentStatus?: TAssessmentStatus;
  officerId?: number;
  intakeTerm?: string;
  intakeYear?: number;
  submittedFrom?: string;
  submittedTo?: string;
}

/** The letter filter: a current letter's status, or none for no current letter. */
export type TLetterFilter = "pending_approval" | "approved" | "rejected" | "none";

/** The required documents with no file yet, the label as shown: customLabel or the type. */
export const requirementLabel = (requirement: IDocumentRequirement) =>
  requirement.customLabel || requirement.documentType;

/** 182044 -> "178 KB" */
export const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function useApplicationOptions(enabled = true) {
  return useQuery({
    queryKey: ["applications", "options"],
    queryFn: async () =>
      (await api.get<IApiResponse<IApplicationOptions>>("/applications/options")).data.data,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useApplications(filters: IApplicationFilters) {
  return useQuery({
    queryKey: ["applications", "list", filters],
    queryFn: async () =>
      (await api.get<IApiResponse<IPage<IApplication>>>("/applications", { params: filters })).data.data,
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useApplication(id: number | null) {
  return useQuery({
    queryKey: ["applications", "detail", id],
    queryFn: async () => (await api.get<IApiResponse<IApplication>>(`/applications/${id}`)).data.data,
    enabled: Boolean(id),
  });
}

function useApplicationMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });
}

/** Wizard steps 1 and 2: create the draft, or change it when going back. */
export const useSaveApplication = () =>
  useApplicationMutation(async ({ id, ...body }: Partial<IApplicationInput> & { id?: number }) =>
    id
      ? (await api.patch<IApiResponse<IApplication>>(`/applications/${id}`, body)).data.data
      : (await api.post<IApiResponse<IApplication>>("/applications", body)).data.data
  );

export const useDeleteApplication = () =>
  useApplicationMutation((id: number) => api.delete(`/applications/${id}`));

/** One file per request, as multipart/form-data (the browser sets the boundary). */
export const useUploadDocument = () =>
  useApplicationMutation(
    async ({
      applicationId,
      documentTypeId,
      file,
    }: {
      applicationId: number;
      documentTypeId: number;
      file: File;
    }) => {
      const form = new FormData();
      form.append("documentTypeId", String(documentTypeId));
      form.append("file", file);
      // Files up to 10 MB: no request timeout for the upload.
      return (
        await api.post<IApiResponse<IApplicationDocument>>(`/applications/${applicationId}/documents`, form, {
          timeout: 0,
        })
      ).data.data;
    }
  );

export const useDeleteDocument = () =>
  useApplicationMutation((documentId: number) => api.delete(`/applications/documents/${documentId}`));

export const useSubmitApplication = () =>
  useApplicationMutation(
    async (id: number) =>
      (await api.post<IApiResponse<IApplication>>(`/applications/${id}/submit`, { confirmed: true })).data
        .data
  );

export const useSetOfficer = () =>
  useApplicationMutation(
    async ({ id, officerId }: { id: number; officerId: number | null }) =>
      (await api.put<IApiResponse<IApplication>>(`/applications/${id}/officer`, { officerId })).data.data
  );

/** A fresh, short-lived (5 minute) link for each download; never stored. Opens the file. */
export const downloadDocument = (documentId: number) =>
  downloadFetchedUrl(
    async () =>
      (
        await api.get<IApiResponse<{ url: string; expiresIn: number }>>(
          `/applications/documents/${documentId}/download-url`
        )
      ).data.data.url
  );

/** One AI reading of a document (from a run or from Extract), as in an assessment run's documents. */
export interface IDocumentReading extends IAssessmentDocument {
  id: number;
  assessmentId: number | null; // null = from Extract
  requestedBy: { id: number; name: string } | null;
  createdAt: string;
}

/** The newest reading of a document, null if it was never read. */
export function useDocumentReading(documentId: number | null) {
  return useQuery({
    queryKey: ["applications", "reading", documentId],
    queryFn: async () =>
      (
        await api.get<IApiResponse<IDocumentReading | null>>(
          `/applications/documents/${documentId}/extraction`
        )
      ).data.data,
    enabled: Boolean(documentId),
  });
}

/**
 * Extract: the AI reads one document now (up to about a minute). It never changes the application or
 * its assessment. Needs Applications create and the institution's OpenAI key (409 without).
 */
export function useExtractDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: number) =>
      (
        await api.post<IApiResponse<IDocumentReading>>(
          `/applications/documents/${documentId}/extract`,
          undefined,
          {
            timeout: 0, // the AI may take a minute
          }
        )
      ).data.data,
    onSuccess: (reading) =>
      queryClient.setQueryData(["applications", "reading", reading.documentId], reading),
  });
}

/** Change outcome on a decided (completed) application, with a reason. Needs Applications update. */
export function useChangeOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: number;
      outcome: "conditional_offer" | "rejection";
      reason: string;
    }) => (await api.put<IApiResponse<IApplication>>(`/applications/${id}/outcome`, body)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

/** One event of an application's history (its Activity tab), newest first. */
export interface IActivityItem {
  id: string;
  at: string;
  entityType: string;
  entityId: number;
  action: "create" | "update" | "delete" | string;
  title: string; // e.g. "Assessment completed: Conditional Offer (99%)"
  details: Record<string, unknown> | null; // {field: {from, to}}; for a run {outcome, confidence, summary, errorMessage}
  user: { id: number; name: string } | null; // null = System
}

export function useApplicationActivity(applicationId: number | null, limit: number) {
  return useQuery({
    queryKey: ["applications", "activity", applicationId, limit],
    queryFn: async () =>
      (
        await api.get<IApiResponse<IPage<IActivityItem>>>(`/applications/${applicationId}/activity`, {
          params: { page: 1, limit },
        })
      ).data.data,
    enabled: Boolean(applicationId),
    placeholderData: keepPreviousData,
  });
}
