import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse } from "../types";

// The organization's settings: one record per tenant. Needs the Settings permission (read to see,
// update to save; by default the Super Admin saves and the Institution Admin only reads).

export interface ISettings {
  // Institution details
  name: string;
  code: string | null; // read only, set by the Firmli team
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  website: string | null; // http(s)://...; also {{institution_website}} in templates
  // Letter branding: the letterhead's line, headings and table headers; null = Firmli's navy
  brandColor: string | null; // "#1E3A8A", in capitals
  // Automation
  autoAssessment: boolean;
  autoLetterGeneration: boolean;
  autoEmailDispatch: boolean;
  // Decision safety
  autoApproveOffers: boolean;
  autoApproveRejections: boolean; // only with requireRejectionApproval off
  requireRejectionApproval: boolean;
  requireManualReviewEdgeCases: boolean;
  flagLowConfidence: boolean;
  flagMissingDocuments: boolean;
  offerConfidenceThreshold: number; // 0 to 1
  rejectionConfidenceThreshold: number;
  // Default reviewer and email
  defaultReviewerId: number | null;
  emailMaxRetries: number; // 0 to 10
  // Own email server (SMTP); off = emails go through Firmli's server in the institution's name
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean; // true for port 465
  smtpUser: string | null;
  smtpFromEmail: string | null; // required when smtpEnabled
  smtpFromName: string | null; // defaults to the institution name
  // AI
  extractionModelId: number;
  extractionFallbackModelId: number;
  assessmentModelId: number;
  assessmentEscalationModelId: number;
  verifyDocumentType: boolean;
  extractionPrompt: string | null; // null = the built-in prompt; may use {category}
  assessmentPrompt: string | null;
  // Read only
  openaiApiKey: string | null; // the institution's own OpenAI key, masked ("sk-...abcd"), null = none
  defaultReviewer: { id: number; name: string } | null;
  aiConfigured: boolean; // the institution saved an OpenAI key: show "AI Active"
  smtpPasswordSet: boolean; // an SMTP password is saved (it is never sent back)
  // Who students see emails from: from = "Name <address>"; name / address when the API sends them apart.
  emailSender: {
    type: "custom" | "default";
    from: string | null;
    name?: string | null;
    address?: string | null;
  };
  logo: { url: string; expiresIn: number } | null; // a short-lived link: use it at once, never store it
  updatedAt: string;
}

export type TSettingsInput = Partial<
  Omit<
    ISettings,
    "code" | "defaultReviewer" | "aiConfigured" | "smtpPasswordSet" | "emailSender" | "logo" | "updatedAt"
  >
> & {
  smtpPassword?: string; // write only: a new one sets or replaces it, "" removes it, left out keeps it
};
// openaiApiKey is write only too: a new key sets or replaces it, null removes it, left out keeps it.

/** An AI model from Settings options; they come sorted by provider (OpenAI, then Anthropic). */
export interface IAiModel {
  id: number;
  code: string;
  name: string;
  description: string | null;
  provider?: { code: string; name: string }; // "OpenAI (ChatGPT)", "Anthropic (Claude)"
  available?: boolean; // false = the app can't call that provider yet (Claude): shown, not pickable
  // USD per 1M tokens, null = not set yet (lib/aiUsage.ts formatModelPrice)
  inputPricePer1m: number | null;
  cachedInputPricePer1m: number | null;
  outputPricePer1m: number | null;
}

/** Dropdown groups, one per provider in the API's order; a model not available yet is disabled. */
export function modelGroups<T extends { value: string; label: string }>(
  models: IAiModel[],
  toItem: (model: IAiModel) => T
) {
  const groups: { group: string; items: (T & { disabled?: boolean })[] }[] = [];
  models.forEach((model) => {
    const group = model.provider?.name ?? "Models";
    let entry = groups.find((item) => item.group === group);
    if (!entry) groups.push((entry = { group, items: [] }));
    entry.items.push({ ...toItem(model), disabled: model.available === false });
  });
  return groups;
}

export interface ISettingsOptions {
  aiModels: IAiModel[];
  reviewers: { id: number; name: string; email: string; roleName: string }[]; // who can log in: active, or inactive (not logged in yet)
}

export const MAX_EMAIL_RETRIES = 10;
export const DEFAULT_BRAND_COLOR = "#1E3A8A"; // Firmli's navy, when no colour is set
export const LOGO_MAX_MB = 2;
export const LOGO_TYPES = ["image/png", "image/jpeg"];
export const MAX_PROMPT_LENGTH = 20000;

export function useSettings(enabled = true) {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get<IApiResponse<ISettings>>("/settings")).data.data,
    enabled,
  });
}

export function useSettingsOptions(enabled = true) {
  return useQuery({
    queryKey: ["settings", "options"],
    queryFn: async () => (await api.get<IApiResponse<ISettingsOptions>>("/settings/options")).data.data,
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Saves the fields sent; the others stay. One save that changes something is one audit entry. */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TSettingsInput) =>
      (await api.patch<IApiResponse<ISettings>>("/settings", body)).data.data,
    onSuccess: (saved) => {
      queryClient.setQueryData(["settings"], saved);
      // The institution name is also the company name in the header (from /auth/me).
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/**
 * Sends a test email with the saved settings (your server or Firmli's), to `to` or else to you.
 * A server that refuses answers 502 with its reason, e.g. "Invalid login: 535 Authentication failed".
 */
export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (to?: string) =>
      (
        await api.post<IApiResponse<{ sentTo: string; sender: "custom" | "default" }>>(
          "/settings/test-email",
          {
            to: to || undefined,
          }
        )
      ).data.data,
  });
}

// Only the logo changes: the rest of the form (and its unsaved edits) stays as it is.
function useLogoMutation<T>(mutationFn: (input: T) => Promise<ISettings | null>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (saved) =>
      queryClient.setQueryData<ISettings>(["settings"], (old) =>
        old ? { ...old, logo: saved?.logo ?? null } : (saved ?? old)
      ),
  });
}

/** Uploads or replaces the logo of every letter PDF: PNG or JPG, at most 2 MB (multipart, field "file"). */
export const useUploadLogo = () =>
  useLogoMutation(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.put<IApiResponse<ISettings>>("/settings/logo", form, { timeout: 0 })).data.data;
  });

/** Removes the logo: letters then show the institution name in the brand colour. */
export const useRemoveLogo = () =>
  useLogoMutation(async () => (await api.delete<IApiResponse<ISettings | null>>("/settings/logo")).data.data);
