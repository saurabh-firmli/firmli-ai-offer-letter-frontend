import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import errorHandler from "./errors";
import type { TEmailSendStatus } from "./emails";
import { TLetterType, letterTypeLabels } from "./letterTemplates";
import { downloadFetchedUrl, openFetchedUrl, toOptions } from "./utils";
import { IApiResponse, IOption, IPage } from "../types";

// Letters: Generate Letter fills the program's letter template for the outcome, saves it with a PDF,
// and either approves it at once (Settings) or waits for a person. Needs the Letters permission
// ("letters"): read to see and download, create to generate (with Applications create), update to
// approve or reject. An application has one current letter: the newest that is not replaced.

// superseded: a newer letter was generated, or the decision changed.
export type TLetterStatus = "pending_approval" | "approved" | "rejected" | "superseded";

export const letterStatusColors: Record<TLetterStatus, string> = {
  pending_approval: "orange",
  approved: "green",
  rejected: "red",
  superseded: "gray",
};

export const LETTER_STATUS_ORDER: TLetterStatus[] = [
  "pending_approval",
  "approved",
  "rejected",
  "superseded",
];

export interface ILetterOptions {
  statuses: IOption<TLetterStatus>[];
  letterTypes: IOption<TLetterType>[];
}

/** The current letter as an application carries it (`application.letter`). */
export interface ILetterSummary {
  id: number;
  referenceNumber: string;
  letterType: TLetterType;
  status: TLetterStatus;
  emailStatus?: TEmailSendStatus | null; // on an application's current letter; null = not emailed
}

export interface ILetter extends ILetterSummary {
  version: number; // 1, 2, ... each time it is generated again
  subject: string | null; // plain text
  application: { id: number; applicationNumber: string };
  student: { name: string; email: string };
  program: { id: number; name: string };
  template: { id: number; name: string } | null;
  assessmentId: number | null;
  pdfSizeBytes: number | null;
  generatedBy: { id: number; name: string } | null;
  createdAt: string;
  reviewedBy: { id: number; name: string } | null; // null on an automatic approval
  reviewedAt: string | null;
  reviewNote: string | null; // "Approved automatically (Settings)", or the reason of a rejection
  email?: { id: number; status: TEmailSendStatus; sentAt: string | null } | null; // its latest email
  // Only from GET /letters/:id and Generate: the letter as generated. Sanitize before showing.
  headerHtml?: string | null;
  bodyHtml?: string;
  footerHtml?: string | null;
}

export interface ILetterFilters {
  page?: number;
  limit?: number;
  status?: TLetterStatus; // left out = the current letters (not replaced ones)
  letterType?: TLetterType;
  programId?: number;
  search?: string; // reference, application number or student name
}

/** The letters page, plus how many letters each status has (for the chips). */
export type TLetterPage = IPage<ILetter> & { counts: Record<TLetterStatus, number> };

export function useLetterOptions() {
  return useQuery({
    queryKey: ["letters", "options"],
    queryFn: async () => (await api.get<IApiResponse<ILetterOptions>>("/letters/options")).data.data,
    staleTime: 5 * 60_000,
  });
}

/** "Waiting for Approval": a letter status by its label from GET /letters/options. */
export function useLetterStatusLabel() {
  const options = useLetterOptions();
  return (status: TLetterStatus) =>
    options.data?.statuses.find(({ value }) => value === status)?.label ?? status;
}

/** "Conditional Offer", from GET /letters/options; the built-in words until it loads. */
export function useLetterTypeLabel() {
  const options = useLetterOptions();
  return (type: TLetterType) =>
    options.data?.letterTypes.find(({ value }) => value === type)?.label ?? letterTypeLabels[type];
}

/** The letter types for a filter, from GET /letters/options. */
export function useLetterTypeOptions() {
  const options = useLetterOptions();
  return options.data?.letterTypes ?? toOptions(letterTypeLabels);
}

export function useLetters(filters: ILetterFilters) {
  return useQuery({
    queryKey: ["letters", "list", filters],
    queryFn: async () =>
      (await api.get<IApiResponse<TLetterPage>>("/letters", { params: filters })).data.data,
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

/** One letter with its HTML, for the on-screen view. */
export function useLetter(id: number | null) {
  return useQuery({
    queryKey: ["letters", "detail", id],
    queryFn: async () => (await api.get<IApiResponse<ILetter>>(`/letters/${id}`)).data.data,
    enabled: Boolean(id),
  });
}

/** Every letter of an application, newest first, replaced ones too. */
export function useApplicationLetters(applicationId: number | null) {
  return useQuery({
    queryKey: ["letters", "application", applicationId],
    queryFn: async () =>
      (await api.get<IApiResponse<ILetter[]>>(`/applications/${applicationId}/letters`)).data.data,
    enabled: Boolean(applicationId),
  });
}

// A letter changes the application's current letter, the counts and the bell.
function useLetterAction<TInput>(request: (input: TInput) => Promise<ILetter>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (letter) => {
      queryClient.setQueryData(["letters", "detail", letter.id], letter);
      queryClient.invalidateQueries({ queryKey: ["letters"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/** Generate Letter: needs a decided application (or one in manual review) and a published template. */
export const useGenerateLetter = () =>
  useLetterAction(
    async (applicationId: number) =>
      (
        await api.post<IApiResponse<ILetter>>(`/applications/${applicationId}/letters`, undefined, {
          timeout: 0, // the PDF takes a moment
        })
      ).data.data
  );

/** Approve (note optional) or reject (note required) a letter waiting for approval. */
export const useReviewLetter = () =>
  useLetterAction(
    async ({ id, action, note }: { id: number; action: "approve" | "reject"; note?: string }) =>
      (await api.post<IApiResponse<ILetter>>(`/letters/${id}/${action}`, { note: note || undefined })).data
        .data
  );

/** A short-lived link to the PDF: a download, or with inline one the browser shows (View, a new tab). */
export async function letterPdfUrl(letterId: number, inline = false) {
  const { data } = await api.get<IApiResponse<{ url: string; expiresIn: number }>>(
    `/letters/${letterId}/download-url`,
    { params: inline ? { inline: true } : undefined }
  );
  return data.data;
}

export const downloadLetter = (letterId: number, inline = false) =>
  (inline ? openFetchedUrl : downloadFetchedUrl)(async () => (await letterPdfUrl(letterId, inline)).url);

/** Downloads the PDF (or, inline, opens it in a new tab); a failed link says so in a toast. */
export const openLetterPdf = (letter: { id: number; referenceNumber: string }, { inline = false } = {}) =>
  downloadLetter(letter.id, inline).catch((error) =>
    errorHandler(error, `Could not open the PDF of ${letter.referenceNumber}`)
  );

/**
 * The PDF for the letter's View: the official copy, with the letterhead, logo and colours the student
 * gets. The link expires, so it is fetched again each time the view opens (dropped once it closes),
 * and kept out of the "letters" keys so a live update doesn't reload the PDF being read.
 */
export function useLetterViewUrl(letterId: number | null) {
  return useQuery({
    queryKey: ["letter-pdf", letterId],
    queryFn: () => letterPdfUrl(letterId!, true),
    enabled: Boolean(letterId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
