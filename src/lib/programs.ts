import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { ICampus } from "./campuses";
import { IApiResponse, IPage } from "../types";

export type TStudyMode = "full_time" | "part_time" | "online" | "hybrid";
export type TProgramStatus = "draft" | "active" | "inactive" | "archived";

export const studyModeLabels: Record<TStudyMode, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  online: "Online",
  hybrid: "Hybrid",
};

export const programStatusLabels: Record<TProgramStatus, string> = {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

// Mantine colors for the status badge / dot.
export const programStatusColors: Record<TProgramStatus, string> = {
  draft: "gray",
  active: "green",
  inactive: "orange",
  archived: "dark",
};

export interface IProgram {
  id: number;
  tenantId: number;
  name: string;
  code: string;
  awardLevel: string | null;
  campusId: number | null;
  eligibilitySetId: number | null;
  duration: string | null;
  studyMode: TStudyMode;
  applicationDeadline: string | null; // YYYY-MM-DD
  status: TProgramStatus;
  description: string | null;
  conditionalOfferTemplateId: number | null;
  rejectionTemplateId: number | null;
  manualReviewTemplateId: number | null;
  offerEmailTemplateId: number | null;
  rejectionEmailTemplateId: number | null;
  createdAt: string;
  updatedAt: string;
  campus: Pick<ICampus, "id" | "name" | "city" | "state" | "country"> | null; // read only, for tables
  // Read only; publishedVersion = the number of its published criteria version, null if none yet.
  eligibilitySet: { id: number; name: string; publishedVersion: number | null } | null;
}

// Body of a create / update. Optional fields accept "" or null for "not set".
export type TProgramInput = Partial<
  Omit<IProgram, "id" | "tenantId" | "createdAt" | "updatedAt" | "campus" | "eligibilitySet">
>;

export interface IProgramFilters {
  page?: number;
  limit?: number;
  status?: TProgramStatus;
  studyMode?: TStudyMode;
  campusId?: number;
  eligibilitySetId?: number;
  search?: string;
}

/** One program: New Application reads the picked one's study mode and eligibility criteria. */
export function useProgram(id: number | null) {
  return useQuery({
    queryKey: ["programs", "detail", id],
    queryFn: async () => (await api.get<IApiResponse<IProgram>>(`/programs/${id}`)).data.data,
    enabled: Boolean(id),
  });
}

export function usePrograms(filters: IProgramFilters) {
  return useQuery({
    queryKey: ["programs", filters],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<IPage<IProgram>>>("/programs", {
        params: filters,
      });
      return data.data;
    },
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useSaveProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: TProgramInput & { id?: number }) => {
      const { data } = id
        ? await api.patch<IApiResponse<IProgram>>(`/programs/${id}`, body)
        : await api.post<IApiResponse<IProgram>>("/programs", body);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["programs"] }),
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/programs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["programs"] }),
  });
}
