import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { TEmailType, emailTypeLabels } from "./emailTemplates";
import { toOptions } from "./utils";
import { IApiResponse, IOption, IPage } from "../types";

// Communications: every email to a student (an approved letter sent with the program's email
// template, and the Manual Review Queue's document requests), kept in a log with automatic retries.
// Needs the Communications permission ("communications"): read for the log, create to send a letter,
// update to retry.

// sending: right now; retrying: a try failed and the next one is at nextRetryAt; failed: every try failed.
export type TEmailSendStatus = "sending" | "sent" | "retrying" | "failed";

export const emailSendStatusColors: Record<TEmailSendStatus, string> = {
  sending: "primary",
  sent: "green",
  retrying: "orange",
  failed: "red",
};

export const EMAIL_STATUS_ORDER: TEmailSendStatus[] = ["sending", "sent", "retrying", "failed"];

/** Only these can be sent again by hand (a sent or sending email answers 409). */
export const canRetryEmail = (status: TEmailSendStatus) => status === "failed" || status === "retrying";

export interface IEmailOptions {
  statuses: IOption<TEmailSendStatus>[];
  emailTypes: IOption<TEmailType>[];
}

export interface IEmail {
  id: number;
  emailType: TEmailType;
  status: TEmailSendStatus;
  recipient: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  application: { id: number; applicationNumber: string } | null;
  letter: { id: number; referenceNumber: string } | null;
  attachLetter: boolean;
  template: { id: number; name: string } | null;
  attempts: number;
  maxAttempts: number; // 1 + Max Retry Attempts (Settings)
  lastError: string | null;
  nextRetryAt: string | null;
  sentAt: string | null;
  sender: "custom" | "default" | null; // custom = the institution's SMTP, default = Firmli's
  sentBy: { id: number; name: string } | null; // null = sent automatically
  createdAt: string;
  // Only from GET /emails/:id: the email as sent, ready for the browser (a branded email's logo
  // already points to a short-lived link). Sanitize the HTML before showing it.
  bodyHtml?: string | null;
  bodyText?: string | null;
}

export interface IEmailFilters {
  page?: number;
  limit?: number;
  status?: TEmailSendStatus;
  emailType?: TEmailType;
  applicationId?: number;
  search?: string; // recipient, subject or application number
}

/** The log page, plus how many emails each status has (for the chips). */
export type TEmailPage = IPage<IEmail> & { counts: Record<TEmailSendStatus, number> };

export function useEmailOptions() {
  return useQuery({
    queryKey: ["emails", "options"],
    queryFn: async () => (await api.get<IApiResponse<IEmailOptions>>("/emails/options")).data.data,
    staleTime: 5 * 60_000,
  });
}

/** "Retrying": an email status by its label from GET /emails/options. */
export function useEmailStatusLabel() {
  const options = useEmailOptions();
  return (status: TEmailSendStatus) =>
    options.data?.statuses.find(({ value }) => value === status)?.label ?? status;
}

/** "Document Request", from GET /emails/options; the built-in words until it loads. */
export function useEmailTypeLabel() {
  const options = useEmailOptions();
  return (type: TEmailType) =>
    options.data?.emailTypes.find(({ value }) => value === type)?.label ?? emailTypeLabels[type];
}

/** The email types for a filter, from GET /emails/options. */
export function useEmailTypeOptions() {
  const options = useEmailOptions();
  return options.data?.emailTypes ?? toOptions(emailTypeLabels);
}

export function useEmails(filters: IEmailFilters) {
  return useQuery({
    queryKey: ["emails", "list", filters],
    queryFn: async () => (await api.get<IApiResponse<TEmailPage>>("/emails", { params: filters })).data.data,
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

/** One email with its body, as sent. */
export function useEmail(id: number | null) {
  return useQuery({
    queryKey: ["emails", "detail", id],
    queryFn: async () => (await api.get<IApiResponse<IEmail>>(`/emails/${id}`)).data.data,
    enabled: Boolean(id),
  });
}

/** The application's emails (its Comms card), newest first. */
export function useApplicationEmails(applicationId: number | null) {
  return useQuery({
    queryKey: ["emails", "application", applicationId],
    queryFn: async () =>
      (await api.get<IApiResponse<TEmailPage>>(`/applications/${applicationId}/emails`)).data.data,
    enabled: Boolean(applicationId),
  });
}

// An email changes the log, the letter's and the application's email status, the counts and the bell.
function useEmailAction<TInput>(request: (input: TInput) => Promise<{ email: IEmail; message: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: ({ email }) => {
      queryClient.setQueryData(["emails", "detail", email.id], email);
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["letters"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

const withMessage = async (call: Promise<{ data: IApiResponse<IEmail> }>) => {
  const { data } = await call;
  return { email: data.data, message: data.message };
};

/**
 * Send Email: an approved letter to the student, with the program's email template for its type,
 * or templateId (needed for a Manual Review letter). The message says whether it went, will be
 * retried, or failed.
 */
export const useSendLetter = () =>
  useEmailAction(({ letterId, templateId }: { letterId: number; templateId?: number }) =>
    withMessage(api.post(`/letters/${letterId}/send`, templateId ? { templateId } : {}, { timeout: 0 }))
  );

/** Retry a failed (or waiting) email now. */
export const useRetryEmail = () =>
  useEmailAction((id: number) => withMessage(api.post(`/emails/${id}/retry`, undefined, { timeout: 0 })));
