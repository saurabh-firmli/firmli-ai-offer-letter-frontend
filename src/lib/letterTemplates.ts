import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse } from "../types";

export type TLetterType = "conditional_offer" | "rejection" | "manual_review";
export type TTemplateStatus = "draft" | "published";

export const letterTypeLabels: Record<TLetterType, string> = {
  conditional_offer: "Conditional Offer",
  rejection: "Rejection",
  manual_review: "Manual Review",
};

export const templateStatusLabels: Record<TTemplateStatus, string> = {
  draft: "Draft",
  published: "Published",
};

// Mantine colors for the status badge / dot.
export const templateStatusColors: Record<TTemplateStatus, string> = {
  draft: "gray",
  published: "green",
};

/** A template as the list returns it: without the (large) body, header and footer. */
export interface ILetterTemplateSummary {
  id: number;
  tenantId: number;
  name: string;
  letterType: TLetterType;
  subject: string | null;
  referencePrefix: string;
  signatoryName: string | null;
  signatoryTitle: string | null;
  status: TTemplateStatus;
  createdAt: string;
  updatedAt: string;
}

/** One template from GET /letter-templates/:id, for editing. */
export interface ILetterTemplate extends ILetterTemplateSummary {
  body: string;
  headerHtml: string | null;
  footerHtml: string | null;
}

/** A {{key}} a template may use; label is for the Insert variable dropdown. */
export interface ITemplateVariable {
  key: string;
  label: string;
}

/**
 * Variables that become a block (a table or a list), so they go on a line of their own and never
 * in the one-line subject. Only used for that formatting: the variables themselves always come
 * from the API (an unknown new block variable just inserts inline).
 */
export const BLOCK_VARIABLES = new Set([
  "eligibility_table",
  "document_checklist",
  "conditions",
  "unmet_requirements",
  "missing_documents",
]);

/**
 * Puts {{key}} in place of value[start..end] and returns the new text and the cursor position
 * after it. A block variable gets a line of its own: a line break before / after it when needed.
 */
export function insertVariableText(value: string, start: number, end: number, key: string) {
  const isBlock = BLOCK_VARIABLES.has(key);
  const before = isBlock && start > 0 && value[start - 1] !== "\n" ? "\n" : "";
  const after = isBlock && end < value.length && value[end] !== "\n" ? "\n" : "";
  const token = `${before}{{${key}}}${after}`;
  return { value: value.slice(0, start) + token + value.slice(end), cursor: start + token.length };
}

/** Insert variable dropdown: API order, with block variables in their own group. */
export const toVariableOptions = (variables: ITemplateVariable[] = []) => {
  const toItem = ({ key, label }: ITemplateVariable) => ({ value: key, label });
  const blocks = variables.filter(({ key }) => BLOCK_VARIABLES.has(key));
  return [
    { group: "Text", items: variables.filter(({ key }) => !BLOCK_VARIABLES.has(key)).map(toItem) },
    ...(blocks.length ? [{ group: "Blocks (own line)", items: blocks.map(toItem) }] : []),
  ];
};

// Body of a create / update. Optional fields accept "" or null for "not set".
export type TLetterTemplateInput = Partial<
  Omit<ILetterTemplate, "id" | "tenantId" | "createdAt" | "updatedAt">
>;

export interface ILetterTemplateFilters {
  letterType?: TLetterType;
  status?: TTemplateStatus;
  search?: string;
}

/** Templates sorted by name (no pagination); e.g. { letterType } for a program's dropdown. */
export function useLetterTemplates(filters: ILetterTemplateFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["letter-templates", "list", filters],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<ILetterTemplateSummary[]>>("/letter-templates", {
        params: filters,
      });
      return data.data;
    },
    enabled,
  });
}

/** One template with its body, header and footer; waits until there is an id. */
export function useLetterTemplate(id: number | null) {
  return useQuery({
    queryKey: ["letter-templates", "detail", id],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<ILetterTemplate>>(`/letter-templates/${id}`);
      return data.data;
    },
    enabled: id !== null,
  });
}

/** The allowed {{variables}}; they don't change while the app runs. */
export function useTemplateVariables(enabled = true) {
  return useQuery({
    queryKey: ["letter-template-variables"],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<ITemplateVariable[]>>("/letter-templates/variables");
      return data.data;
    },
    enabled,
    staleTime: Infinity,
  });
}

export function useSaveLetterTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: TLetterTemplateInput & { id?: number }) => {
      const { data } = id
        ? await api.patch<IApiResponse<ILetterTemplate>>(`/letter-templates/${id}`, body)
        : await api.post<IApiResponse<ILetterTemplate>>("/letter-templates", body);
      return data.data;
    },
    // Lists, the edited template and the program form dropdowns.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["letter-templates"] }),
  });
}

export function useDeleteLetterTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/letter-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["letter-templates"] }),
  });
}
