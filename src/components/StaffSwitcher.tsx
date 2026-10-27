// Firmli staff only (a Super Admin of the platform tenant): see the app as any client's user, without
// their password, e.g. to help a client. Every switch is in that client's audit log. A switch gives this
// browser (its cookie, every tab) that user's session; Back to Firmli asks the API for the staff
// member's own session again (POST /auth/switch-back).
import { Stack } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import api from "../lib/api";
import { IUser, userStatusLabels } from "../lib/auth";
import errorHandler from "../lib/errors";
import { roleLabelFromCode } from "../lib/roles";
import { clearSessionData, getSwitchedFrom, setSwitchedFrom, setToken } from "../lib/session";
import { IApiResponse } from "../types";
import { RO_DASHBOARD } from "../routes";
import ErrorState from "./ErrorState";
import FormModal from "./FormModal";
import SearchableSelect from "./SearchableSelect";

interface IStaffTenant {
  id: number;
  name: string;
  isPlatform: boolean;
  users: Pick<IUser, "id" | "name" | "email" | "role" | "status">[];
}

/** True while Firmli staff are switched into another user (Back to Firmli is offered). */
export const isStaffSwitched = () => Boolean(getSwitchedFrom());

/** A Super Admin of Firmli's own tenant: the only one the API lets switch users or use the Platform panel. */
export const isFirmliSuperAdmin = (user: IUser | undefined) =>
  Boolean(user?.tenant?.isPlatform) && user?.role === "super_admin";

/** Switch tenant / user and the Platform panel. While switched, Back to Firmli comes first. */
export const canSwitch = (user: IUser | undefined) => isFirmliSuperAdmin(user) && !isStaffSwitched();

// A full page load, so nothing of the previous user or tenant stays in memory.
const openAs = (token: string) => {
  clearSessionData();
  setToken(token);
  window.location.replace(RO_DASHBOARD);
};

/** Back to Firmli: the switched session ends and the staff member's own one starts again. */
export async function backToFirmli() {
  try {
    const { data } = await api.post<IApiResponse<{ user: IUser; token: string }>>("/auth/switch-back");
    setSwitchedFrom(null);
    openAs(data.data.token);
  } catch (error) {
    // 409: this session was not switched into (the mark was stale), so there is nothing to go back to.
    if (isAxiosError(error) && error.response?.status === 409) setSwitchedFrom(null);
    errorHandler(error, "Could not go back to Firmli");
  }
}

interface IStaffSwitcherProps {
  opened: boolean;
  onClose: () => void;
  currentUserId?: number;
  staffName?: string; // the logged in staff member, remembered for Back to Firmli
}

export default function StaffSwitcher({ opened, onClose, currentUserId, staffName }: IStaffSwitcherProps) {
  const tenants = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => (await api.get<IApiResponse<IStaffTenant[]>>("/dev/users")).data.data,
    enabled: opened,
    staleTime: 5 * 60_000, // platform changes refetch it (lib/platform.ts)
  });

  const switchUser = useMutation({
    mutationFn: async (userId: number) =>
      (await api.post<IApiResponse<{ user: IUser; token: string }>>("/dev/switch-user", { userId })).data
        .data,
    onSuccess: ({ token }) => {
      // The API does not say a session was switched into: remember who did it, for Back to Firmli.
      setSwitchedFrom(staffName ?? "Firmli");
      openAs(token);
    },
    // 409: the user isn't active (a new user must log in once first).
    onError: (error) => errorHandler(error, "Could not switch"),
  });

  const tenantList = tenants.data ?? [];
  const currentTenant = tenantList.find((tenant) => tenant.users.some((user) => user.id === currentUserId));
  const [pickedTenantId, setPickedTenantId] = useState<string | null>(null);
  const shownTenant = tenantList.find(({ id }) => String(id) === pickedTenantId) ?? currentTenant ?? null;

  // Switching tenant opens that tenant's Super Admin (every tenant is created with one).
  const switchTenant = (tenantId: string | null) => {
    setPickedTenantId(tenantId);
    const tenant = tenantList.find(({ id }) => String(id) === tenantId);
    const user =
      tenant?.users.find(({ role, status }) => role === "super_admin" && status === "active") ??
      tenant?.users.find(({ status }) => status === "active");
    if (user) switchUser.mutate(user.id);
  };

  const loadingPlaceholder = (placeholder: string) => (tenants.isLoading ? "Loading..." : placeholder);

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title="Switch tenant / user"
      description="You see the app as that user, without their password. Their audit log shows the switch with your name."
    >
      <Stack>
        <SearchableSelect
          label="Tenant"
          description="Opens that tenant's Super Admin"
          placeholder={loadingPlaceholder("Search a tenant")}
          data={tenantList.map((tenant) => ({
            value: String(tenant.id),
            label: `${tenant.name}${tenant.isPlatform ? " (Firmli)" : ""}`,
            description: `${tenant.users.length} ${tenant.users.length === 1 ? "user" : "users"}`,
          }))}
          value={shownTenant ? String(shownTenant.id) : null}
          onChange={switchTenant}
          nothingFoundMessage="No tenant found"
          maxDropdownHeight={400}
          disabled={switchUser.isPending}
        />
        <SearchableSelect
          label="User"
          description={
            shownTenant ? `Users of ${shownTenant.name}; only active users can be opened` : undefined
          }
          placeholder={loadingPlaceholder("Search a user")}
          data={(shownTenant?.users ?? []).map((user) => ({
            value: String(user.id),
            label: `${user.name} · ${roleLabelFromCode(user.role)}`,
            description: `${user.email}${user.status === "active" ? "" : ` · ${userStatusLabels[user.status]}`}`,
            disabled: user.status !== "active",
          }))}
          value={currentUserId ? String(currentUserId) : null}
          onChange={(value) => value && switchUser.mutate(Number(value))}
          nothingFoundMessage="No user found"
          maxDropdownHeight={400}
          disabled={switchUser.isPending}
        />
      </Stack>
      {tenants.isError && <ErrorState error={tenants.error} title="Could not load the tenants" compact />}
    </FormModal>
  );
}
