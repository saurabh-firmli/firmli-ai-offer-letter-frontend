import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { formatDate } from "./utils";
import { IApiResponse } from "../types";

/*
 * Eligibility: a set (e.g. "UK Masters Standard") has versions v1, v2...; only a draft version can
 * change. Criteria and document requirements belong to a version. Programs pick one set each.
 */

export type TDataType = "text" | "number" | "boolean" | "date";
export type TOperator =
  | "equal_to"
  | "not_equal_to"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between"
  | "one_of"
  | "contains";
export type TVersionStatus = "draft" | "published" | "archived";

export const versionStatusLabels: Record<TVersionStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const versionStatusColors: Record<TVersionStatus, string> = {
  draft: "gray",
  published: "green",
  archived: "dark",
};

/** Dropdown lists for the forms (categories and document types live in the database). */
export interface IEligibilityOptions {
  categories: { id: number; code: string; label: string }[];
  documentTypes: { id: number; code: string; label: string }[];
  dataTypes: { value: TDataType; label: string }[];
  operators: { value: TOperator; label: string }[];
  operatorsByDataType: Record<TDataType, TOperator[]>;
}

export interface IEligibilitySetSummary {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  publishedVersion: number | null;
  draftVersion: number | null;
  programCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IVersionSummary {
  id: number;
  versionNumber: number;
  status: TVersionStatus;
  publishedAt: string | null;
  criteriaCount: number;
}

/** One set from GET /sets/:id: with its versions (newest first) and the programs using it. */
export interface IEligibilitySet extends IEligibilitySetSummary {
  versions: IVersionSummary[];
  programs: { id: number; name: string; code: string }[];
}

export interface ICriterion {
  id: number;
  versionId: number;
  name: string;
  categoryId: number;
  category: string;
  description: string | null;
  dataType: TDataType;
  operator: TOperator;
  unit: string | null;
  requiredValue: string;
  evidenceInstructions: string | null;
  rejectionReason: string | null;
  isMandatory: boolean;
  effectiveDate: string | null;
  expiryDate: string | null;
  sortOrder: number;
  documentTypeIds: number[];
  documentTypes: { id: number; label: string }[];
}

export interface IDocumentRequirement {
  id: number;
  versionId: number;
  documentTypeId: number;
  documentType: string;
  customLabel: string | null;
  instructions: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface IVersion extends Omit<IVersionSummary, "criteriaCount"> {
  eligibilitySetId: number;
  createdAt: string;
  updatedAt: string;
  criteria: ICriterion[];
  documentRequirements: IDocumentRequirement[];
}

export type TCriterionInput = Partial<
  Omit<ICriterion, "id" | "versionId" | "category" | "sortOrder" | "documentTypes">
>;
export type TDocumentInput = Partial<
  Pick<IDocumentRequirement, "documentTypeId" | "customLabel" | "instructions" | "isRequired">
>;

/** "v3 — Draft" */
export const versionLabel = ({ versionNumber, status }: Pick<IVersionSummary, "versionNumber" | "status">) =>
  `v${versionNumber} — ${versionStatusLabels[status]}`;

/** How a criterion's rule reads in a table, e.g. "Between 6.0 and 9.0 IELTS band". */
// Comparisons read best as a symbol: "≥ 3.0 GPA".
const OPERATOR_SYMBOLS: Record<string, string> = {
  equal_to: "=",
  not_equal_to: "≠",
  greater_than: ">",
  greater_than_or_equal: "≥",
  less_than: "<",
  less_than_or_equal: "≤",
};

/**
 * A rule in pieces, for showing it as chips: a comparison gets its symbol in front of the value
 * ("≥ 3.0"), the others a word before the values ("between" 6.0 – 9.0, "one of" UK / Ireland).
 */
export function ruleParts(
  criterion: Pick<ICriterion, "dataType" | "operator" | "requiredValue" | "unit">,
  options?: IEligibilityOptions
) {
  const { dataType, operator, requiredValue, unit } = criterion;
  const show = (value: string) =>
    dataType === "date"
      ? formatDate(value)
      : dataType === "boolean"
        ? value === "true"
          ? "Yes"
          : "No"
        : value;
  const parts = requiredValue.split(",").map((part) => show(part.trim()));
  const symbol = OPERATOR_SYMBOLS[operator];
  const word = (options?.operators.find(({ value }) => value === operator)?.label ?? operator).toLowerCase();
  return {
    symbol: symbol ?? null,
    word: symbol ? null : word,
    values:
      operator === "between"
        ? [`${parts[0]} – ${parts[1]}`]
        : operator === "one_of"
          ? parts
          : [show(requiredValue)],
    unit: unit || null,
  };
}

export function formatRule(
  criterion: Pick<ICriterion, "dataType" | "operator" | "requiredValue" | "unit">,
  options?: IEligibilityOptions
) {
  const { dataType, operator, requiredValue, unit } = criterion;
  const operatorLabel = options?.operators.find(({ value }) => value === operator)?.label ?? operator;
  const show = (value: string) =>
    dataType === "date"
      ? formatDate(value)
      : dataType === "boolean"
        ? value === "true"
          ? "Yes"
          : "No"
        : value;
  const parts = requiredValue.split(",").map((part) => show(part.trim()));
  const value =
    operator === "between"
      ? `${parts[0]} and ${parts[1]}`
      : operator === "one_of"
        ? parts.join(", ")
        : show(requiredValue);
  return [operatorLabel, value, unit].filter(Boolean).join(" ");
}

const BASE = "/eligibility";

export function useEligibilityOptions(enabled = true) {
  return useQuery({
    queryKey: ["eligibility", "options"],
    queryFn: async () => (await api.get<IApiResponse<IEligibilityOptions>>(`${BASE}/options`)).data.data,
    enabled,
    staleTime: Infinity,
  });
}

export function useEligibilitySets(search = "", enabled = true) {
  return useQuery({
    queryKey: ["eligibility", "sets", search],
    queryFn: async () =>
      (
        await api.get<IApiResponse<IEligibilitySetSummary[]>>(`${BASE}/sets`, {
          params: { search: search || undefined },
        })
      ).data.data,
    enabled,
  });
}

export function useEligibilitySet(id: number | null) {
  return useQuery({
    queryKey: ["eligibility", "set", id],
    queryFn: async () => (await api.get<IApiResponse<IEligibilitySet>>(`${BASE}/sets/${id}`)).data.data,
    enabled: id !== null,
  });
}

export function useEligibilityVersion(id: number | null) {
  return useQuery({
    queryKey: ["eligibility", "version", id],
    queryFn: async () => (await api.get<IApiResponse<IVersion>>(`${BASE}/versions/${id}`)).data.data,
    enabled: id !== null,
  });
}

/**
 * Every eligibility change can move counts, statuses and assignments shown elsewhere, so a
 * successful call refreshes all eligibility data and the programs (they show their set).
 */
function useEligibilityMutation<TVariables, TResult = unknown>(
  mutationFn: (variables: TVariables) => Promise<TResult>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["eligibility"] }),
        queryClient.invalidateQueries({ queryKey: ["programs"] }),
      ]),
  });
}

const call = async <T>(request: Promise<{ data: IApiResponse<T> }>) => (await request).data.data;

export const useSaveSet = () =>
  useEligibilityMutation(({ id, ...body }: { id?: number; name: string; description: string }) =>
    call<IEligibilitySetSummary>(id ? api.patch(`${BASE}/sets/${id}`, body) : api.post(`${BASE}/sets`, body))
  );

export const useDeleteSet = () =>
  useEligibilityMutation((id: number) => call(api.delete(`${BASE}/sets/${id}`)));

export const useAssignPrograms = () =>
  useEligibilityMutation(({ setId, programIds }: { setId: number; programIds: number[] }) =>
    call(api.put(`${BASE}/sets/${setId}/programs`, { programIds }))
  );

export const useNewVersion = () =>
  useEligibilityMutation((setId: number) => call<IVersion>(api.post(`${BASE}/sets/${setId}/versions`)));

export const usePublishVersion = () =>
  useEligibilityMutation((versionId: number) =>
    call<IVersion>(api.post(`${BASE}/versions/${versionId}/publish`))
  );

export const useCopyFromVersion = () =>
  useEligibilityMutation(({ versionId, fromVersionId }: { versionId: number; fromVersionId: number }) =>
    call<IVersion>(api.post(`${BASE}/versions/${versionId}/copy-from`, { versionId: fromVersionId }))
  );

export const useDiscardDraft = () =>
  useEligibilityMutation((versionId: number) => call(api.delete(`${BASE}/versions/${versionId}`)));

export const useSaveCriterion = () =>
  useEligibilityMutation(({ id, versionId, ...body }: TCriterionInput & { id?: number; versionId: number }) =>
    call<ICriterion>(
      id
        ? api.patch(`${BASE}/criteria/${id}`, body)
        : api.post(`${BASE}/versions/${versionId}/criteria`, body)
    )
  );

export const useDeleteCriterion = () =>
  useEligibilityMutation((id: number) => call(api.delete(`${BASE}/criteria/${id}`)));

export const useReorderCriteria = () =>
  useEligibilityMutation(({ versionId, criterionIds }: { versionId: number; criterionIds: number[] }) =>
    call(api.put(`${BASE}/versions/${versionId}/criteria/order`, { criterionIds }))
  );

export const useSaveDocument = () =>
  useEligibilityMutation(({ id, versionId, ...body }: TDocumentInput & { id?: number; versionId: number }) =>
    call<IDocumentRequirement>(
      id
        ? api.patch(`${BASE}/documents/${id}`, body)
        : api.post(`${BASE}/versions/${versionId}/documents`, body)
    )
  );

export const useDeleteDocument = () =>
  useEligibilityMutation((id: number) => call(api.delete(`${BASE}/documents/${id}`)));
