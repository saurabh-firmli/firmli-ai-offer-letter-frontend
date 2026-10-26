import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse } from "../types";

// Notes on an application: a record of the work, so they can't be edited or deleted. Added on the
// application page (Applications create) or on a review case (Manual Review update); every note shows
// on the application.

export const NOTE_MAX = 5000;

export interface INote {
  id: number;
  reviewId: number | null; // the review case it was added on; null = the application page
  note: string;
  createdBy: { id: number; name: string } | null;
  createdAt: string;
}

/** All notes of an application, newest first. */
export function useApplicationNotes(applicationId: number | null) {
  return useQuery({
    queryKey: ["applications", "notes", applicationId],
    queryFn: async () =>
      (await api.get<IApiResponse<INote[]>>(`/applications/${applicationId}/notes`)).data.data,
    enabled: Boolean(applicationId),
  });
}

/** Add a note from the application page (on: "application") or on a review case (on: "review"). */
export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ on, id, note }: { on: "application" | "review"; id: number; note: string }) =>
      (
        await api.post<IApiResponse<INote>>(
          on === "application" ? `/applications/${id}/notes` : `/reviews/${id}/notes`,
          {
            note,
          }
        )
      ).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications", "notes"] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "detail"] });
    },
  });
}
