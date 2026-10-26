import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import type { TUserStatus } from "./auth";
import { IApiResponse, IOption, IPage } from "../types";

// The platform admin panel, for Firmli staff only (users of the platform tenant): every client
// tenant, create one with its first Super Admin, add users, block / unblock or remove it. lib/api.ts
// sends these calls with the staff token, also while switched into a client's user; others get 403.

export type TTenantStatus = "active" | "blocked";

export const tenantStatusLabels: Record<TTenantStatus, string> = {
  active: "Active",
  blocked: "Blocked",
};

export const tenantStatusColors: Record<TTenantStatus, string> = {
  active: "green",
  blocked: "red",
};

export interface ITenant {
  id: number;
  name: string;
  code: string | null;
  contactEmail: string | null;
  status: TTenantStatus;
  isPlatform: boolean; // Firmli's own tenant: can't be blocked or removed
  userCount: number;
  activeUserCount: number;
  applicationCount: number;
  lastLoginAt: string | null; // the latest login of any of its users
  createdAt: string;
  // Only on GET /platform/tenants/:id (and create): Super Admins first.
  users?: {
    id: number;
    name: string;
    email: string;
    roleId: number;
    role: string;
    roleName: string;
    status: TUserStatus;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
}

export interface IPlatformOptions {
  statuses: IOption<TTenantStatus>[];
  roles: { id: number; code: string; name: string }[];
}

export interface ITenantFilters {
  page?: number;
  limit?: number;
  status?: TTenantStatus;
  search?: string; // name, code or contact email
}

export type TTenantPage = IPage<ITenant> & { counts: Record<TTenantStatus, number> };

export interface ITenantInput {
  name: string;
  code?: string; // 2 to 20 of A-Z, 0-9, -; stored in capitals
  contactEmail?: string;
}

export interface INewUserInput {
  name: string;
  email: string;
  password: string;
  roleId?: number;
  status?: TUserStatus;
}

export function usePlatformOptions(enabled = true) {
  return useQuery({
    queryKey: ["platform", "options"],
    queryFn: async () => (await api.get<IApiResponse<IPlatformOptions>>("/platform/options")).data.data,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useTenants(filters: ITenantFilters) {
  return useQuery({
    queryKey: ["platform", "tenants", filters],
    queryFn: async () =>
      (await api.get<IApiResponse<TTenantPage>>("/platform/tenants", { params: filters })).data.data,
    placeholderData: keepPreviousData,
  });
}

export function useTenant(id: number | null) {
  return useQuery({
    queryKey: ["platform", "tenant", id],
    queryFn: async () => (await api.get<IApiResponse<ITenant>>(`/platform/tenants/${id}`)).data.data,
    enabled: Boolean(id),
  });
}

function usePlatformMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform"] });
      // The switcher lists every tenant's users too.
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
    },
  });
}

/** New tenant with its first Super Admin (inactive until their first login), all or nothing. */
export const useCreateTenant = () =>
  usePlatformMutation(
    async (body: ITenantInput & { admin: { name: string; email: string; password: string } }) =>
      (await api.post<IApiResponse<ITenant>>("/platform/tenants", body)).data.data
  );

/** Name, code, contact email, or status: blocked logs every user of the tenant out at once. */
export const useUpdateTenant = () =>
  usePlatformMutation(
    async ({ id, ...body }: Partial<ITenantInput> & { id: number; status?: TTenantStatus }) =>
      (await api.patch<IApiResponse<ITenant>>(`/platform/tenants/${id}`, body)).data.data
  );

/** Remove (soft delete): the tenant and its users disappear and their logins stop. */
export const useDeleteTenant = () =>
  usePlatformMutation((id: number) => api.delete(`/platform/tenants/${id}`));

export const useAddTenantUser = () =>
  usePlatformMutation(
    async ({ tenantId, ...body }: INewUserInput & { tenantId: number }) =>
      (
        await api.post<IApiResponse<{ id: number; name: string; email: string }>>(
          `/platform/tenants/${tenantId}/users`,
          body
        )
      ).data.data
  );
