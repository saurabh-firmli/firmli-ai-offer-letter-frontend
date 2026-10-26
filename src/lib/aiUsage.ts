import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse, IPage } from "../types";

// AI Usage: the tokens and cost of the institution's AI calls, read only. Every call (extraction,
// assessment, ...) is logged by the backend. Needs the AI Usage permission ("ai_usage", read).

export type TAiOperation =
  "extraction" | "extraction_fallback" | "document_verification" | "assessment" | "assessment_escalation";

// The API sends a label with each call and group; these fill the Operation filter.
export const aiOperationLabels: Record<TAiOperation, string> = {
  extraction: "Document extraction",
  extraction_fallback: "Extraction fallback",
  document_verification: "Document verification",
  assessment: "Eligibility assessment",
  assessment_escalation: "Assessment escalation",
};

export type TAiCallStatus = "success" | "failed";

export interface IAiUsageFilters {
  from?: string; // YYYY-MM-DD, both days included
  to?: string;
  operation?: TAiOperation;
  modelId?: number;
  applicationId?: number;
  status?: TAiCallStatus;
}

// costUsd is null when none of the calls in the group has a price yet.
export interface IAiUsageSummary {
  totals: {
    requests: number;
    failed: number;
    inputTokens: number;
    cachedInputTokens: number; // part of inputTokens
    outputTokens: number;
    totalTokens: number; // input + output
    unpricedRequests: number; // calls without a cost: above 0 = "some costs unknown"
    costUsd: number | null;
  };
  byDay: { date: string; requests: number; tokens: number; costUsd: number | null }[]; // every day of the range
  byModel: {
    modelId: number;
    modelCode: string;
    modelName: string;
    providerName?: string; // "OpenAI (ChatGPT)"
    requests: number;
    tokens: number;
    costUsd: number | null;
  }[];
  byOperation: {
    operation: TAiOperation;
    label: string;
    requests: number;
    tokens: number;
    costUsd: number | null;
  }[];
}

export interface IAiCall {
  id: number;
  operation: TAiOperation;
  operationLabel: string;
  model: { code: string; name: string; provider?: string } | null;
  status: TAiCallStatus;
  errorMessage: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
  durationMs: number | null;
  application: { id: number; applicationNumber: string } | null; // null for calls not tied to one
  documentId: number | null;
  triggeredBy: { id: number; name: string } | null; // null = ran automatically
  providerRequestId: string | null;
  createdAt: string;
}

// The viewer's offset, so the chart's days are their days (India: 330).
const utcOffset = () => -new Date().getTimezoneOffset();

export function useAiUsageSummary(filters: IAiUsageFilters) {
  return useQuery({
    queryKey: ["ai-usage", "summary", filters],
    queryFn: async () =>
      (
        await api.get<IApiResponse<IAiUsageSummary>>("/ai-usage/summary", {
          params: { ...filters, utcOffset: utcOffset() },
        })
      ).data.data,
    placeholderData: keepPreviousData,
  });
}

export function useAiCalls(filters: IAiUsageFilters & { page: number; limit: number }) {
  return useQuery({
    queryKey: ["ai-usage", "list", filters],
    queryFn: async () =>
      (
        await api.get<IApiResponse<IPage<IAiCall>>>("/ai-usage", {
          params: { ...filters, utcOffset: utcOffset() },
        })
      ).data.data,
    placeholderData: keepPreviousData,
  });
}

/** US dollars: "$4.84", "$0.40", small amounts to 4 decimals ("$0.0021"); null (no price yet) -> "—". */
export const formatUsd = (value: number | null) => {
  if (value === null) return "—";
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  // Up to 4 decimals, but never fewer than 2: 0.4 -> "0.40", 0.0271 -> "0.0271".
  return `$${value.toFixed(4).replace(/(\.\d\d\d*?)0+$/, "$1")}`;
};

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });

/** 2050000 -> "2.05M", 12900 -> "12.9K", 900 -> "900". */
export const formatTokens = (value: number) => compact.format(value);

/** A model's price per 1M tokens for its dropdown: "$0.40 in · $1.60 out per 1M tokens". */
export const formatModelPrice = (model: {
  inputPricePer1m: number | null;
  outputPricePer1m: number | null;
}) =>
  model.inputPricePer1m === null && model.outputPricePer1m === null
    ? "Price not set"
    : `${formatUsd(model.inputPricePer1m)} in · ${formatUsd(model.outputPricePer1m)} out per 1M tokens`;
