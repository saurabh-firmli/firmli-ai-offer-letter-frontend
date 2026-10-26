import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { IUser, TUserStatus } from "./auth";
import { IApiResponse } from "../types";

// Needs the Users permission (Super Admin by default; Institution Admin may only read); others get a
// 403 from /users. Only a Super Admin may add, change, block or delete a Super Admin.

// Body of a create / update. On update, send password only to reset it.
export interface IUserInput {
  name?: string;
  email?: string;
  password?: string;
  roleId?: number; // from GET /roles
  status?: TUserStatus; // block / unblock; nobody can block themselves
}

/** All users of the tenant, sorted by name. */
export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<IUser[]>>("/users");
      return data.data;
    },
    enabled,
  });
}

// The logged in user may have edited themselves, so the header refreshes too.
const refreshLists = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["users"] }),
    queryClient.invalidateQueries({ queryKey: ["me"] }),
  ]);

export function useSaveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: IUserInput & { id?: number }) => {
      const { data } = id
        ? await api.patch<IApiResponse<IUser>>(`/users/${id}`, body)
        : await api.post<IApiResponse<IUser>>("/users", body);
      return data.data;
    },
    onSuccess: () => refreshLists(queryClient),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => refreshLists(queryClient),
  });
}

/** A random 12 character password for a new user or a reset (no look-alike characters). */
export function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => chars[n % chars.length]).join("");
}

/**
 * Emails the user their login page, email and password. The password must be their current one
 * (the backend checks it against the stored hash); it is shown only once, right after creating.
 * With tenantId it is another tenant's user (Firmli staff, Platform Admin), with the staff token.
 */
export function useSendCredentials() {
  return useMutation({
    mutationFn: async ({ id, password, tenantId }: { id: number; password: string; tenantId?: number }) =>
      (
        await api.post<IApiResponse<{ sentTo: string }>>(
          tenantId
            ? `/platform/tenants/${tenantId}/users/${id}/send-credentials`
            : `/users/${id}/send-credentials`,
          { password }
        )
      ).data.data,
  });
}
