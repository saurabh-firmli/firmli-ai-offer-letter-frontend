import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse } from "../types";

// Unique per tenant by name + city: the same name may exist in another city.
// The location fields are null only for a campus created before cities existed, until it is edited.
export interface ICampus {
  id: number;
  tenantId: number;
  name: string;
  cityId: number | null;
  stateId: number | null; // from the city
  countryId: number | null; // from the city
  city: string | null;
  state: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

/** "Ludhiana, Punjab, India"; empty for a campus without a city. */
export const formatCampusLocation = ({ city, state, country }: Pick<ICampus, "city" | "state" | "country">) =>
  [city, state, country].filter(Boolean).join(", ");

/**
 * Campus dropdown options; Select values are strings, so the id is converted back with Number().
 * The location is in the label so campuses sharing a name can be told apart.
 */
export const toCampusOptions = (campuses: ICampus[] = []) =>
  campuses.map((campus) => {
    const location = formatCampusLocation(campus);
    return { value: String(campus.id), label: location ? `${campus.name} — ${location}` : campus.name };
  });

// Body of a create / update; both are required on create. State and country come from the city.
export type TCampusInput = { name?: string; cityId?: number };

/** Every campus, sorted by name (no pagination). */
export function useCampuses(search = "") {
  return useQuery({
    queryKey: ["campuses", search],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<ICampus[]>>("/campuses", {
        params: { search: search || undefined },
      });
      return data.data;
    },
  });
}

// Program rows show the campus name, so they refresh too.
const refreshLists = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["campuses"] }),
    queryClient.invalidateQueries({ queryKey: ["programs"] }),
  ]);

export function useSaveCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: TCampusInput & { id?: number }) => {
      const { data } = id
        ? await api.patch<IApiResponse<ICampus>>(`/campuses/${id}`, body)
        : await api.post<IApiResponse<ICampus>>("/campuses", body);
      return data.data;
    },
    // Returned so the caller's onSuccess runs after the dropdowns have the new campus.
    onSuccess: () => refreshLists(queryClient),
  });
}

export function useDeleteCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/campuses/${id}`),
    onSuccess: () => refreshLists(queryClient),
  });
}
