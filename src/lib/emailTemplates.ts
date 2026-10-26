import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { ITemplateVariable } from "./letterTemplates";
import { IApiResponse } from "../types";

export type TEmailType = "conditional_offer" | "rejection" | "manual_review" | "document_request" | "custom";
export type TEmailStatus = "draft" | "published";

export const emailTypeLabels: Record<TEmailType, string> = {
  conditional_offer: "Conditional Offer",
  rejection: "Rejection",
  manual_review: "Manual Review",
  document_request: "Document Request",
  custom: "Custom",
};

export const emailStatusLabels: Record<TEmailStatus, string> = {
  draft: "Draft",
  published: "Published",
};

// Mantine colors for the status badge / dot.
export const emailStatusColors: Record<TEmailStatus, string> = {
  draft: "gray",
  published: "green",
};

/** Only these types have a PDF letter that the email can attach. */
export const hasLetter = (emailType: TEmailType) =>
  emailType === "conditional_offer" || emailType === "rejection" || emailType === "manual_review";

/** A template as the list returns it: without the (large) body. */
export interface IEmailTemplateSummary {
  id: number;
  tenantId: number;
  name: string;
  emailType: TEmailType;
  subject: string | null;
  cc: string | null; // "a@x.com, b@x.com"
  bcc: string | null;
  attachPdfLetter: boolean;
  status: TEmailStatus;
  createdAt: string;
  updatedAt: string;
}

/** One template from GET /email-templates/:id, for editing. */
export interface IEmailTemplate extends IEmailTemplateSummary {
  body: string;
}

// Body of a create / update. Optional fields accept "" or null for "not set".
export type TEmailTemplateInput = Partial<
  Omit<IEmailTemplate, "id" | "tenantId" | "createdAt" | "updatedAt">
>;

export interface IEmailTemplateFilters {
  emailType?: TEmailType;
  status?: TEmailStatus;
  search?: string;
}

/** Templates sorted by name (no pagination); e.g. { emailType } for a program's dropdown. */
export function useEmailTemplates(filters: IEmailTemplateFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["email-templates", "list", filters],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<IEmailTemplateSummary[]>>("/email-templates", {
        params: filters,
      });
      return data.data;
    },
    enabled,
  });
}

/** One template with its body; waits until there is an id. */
export function useEmailTemplate(id: number | null) {
  return useQuery({
    queryKey: ["email-templates", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<IEmailTemplate>>(`/email-templates/${id}`);
      return data.data;
    },
    enabled: id !== null,
  });
}

/** The allowed {{variables}} (the same list as letters); they don't change while the app runs. */
export function useEmailVariables(enabled = true) {
  return useQuery({
    queryKey: ["email-template-variables"],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<ITemplateVariable[]>>("/email-templates/variables");
      return data.data;
    },
    enabled,
    staleTime: Infinity,
  });
}

export function useSaveEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: TEmailTemplateInput & { id?: number }) => {
      const { data } = id
        ? await api.patch<IApiResponse<IEmailTemplate>>(`/email-templates/${id}`, body)
        : await api.post<IApiResponse<IEmailTemplate>>("/email-templates", body);
      return data.data;
    },
    // Lists, the edited template and the program form dropdowns.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-templates"] }),
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/email-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email-templates"] }),
  });
}
