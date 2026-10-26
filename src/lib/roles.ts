import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconBriefcase,
  IconClipboardCheck,
  IconEye,
  IconSettings,
  IconShieldCheck,
  IconUser,
} from "@tabler/icons-react";
import api from "./api";
import { TAction, TModule, TPermissions } from "./auth";
import { IApiResponse } from "../types";

// The roles are the same for every tenant; each starts with default permissions that a tenant's
// Super Admin can change for that tenant only. The Super Admin role itself never changes.

export interface IRole {
  id: number;
  code: string; // e.g. super_admin, admissions_officer, read_only
  name: string;
  description: string | null;
  editable: boolean; // false for the Super Admin
  customized: boolean; // this tenant changed the defaults
  userCount?: number; // users of this tenant with the role (any status; deleted ones not counted)
  permissions: TPermissions;
}

export interface IRoleModule {
  code: TModule;
  name: string;
  actions: TAction[]; // the switches it has, e.g. Audit Logs only read
}

// Words a non-technical user knows, in place of create / read / update / delete (Roles, My Profile).
export const PERMISSION_ACTIONS: { action: TAction; label: string }[] = [
  { action: "read", label: "View" },
  { action: "create", label: "Add" },
  { action: "update", label: "Edit" },
  { action: "delete", label: "Delete" },
];

// A module's switches come from the API (GET /roles, GET /auth/me modules); all four until they load.
export const ALL_ACTIONS: TAction[] = ["create", "read", "update", "delete"];

/** A module's access in one word, with its badge color: the same on Roles and My Profile. */
export const ACCESS_LEVELS = {
  full: { label: "Full access", color: "green" },
  partial: { label: "Partial", color: "orange" },
  view: { label: "View only", color: "primary" },
  none: { label: "No access", color: "gray" },
};

export const accessSummary = (allowed: TAction[], available: TAction[]) => {
  if (!allowed.length) return ACCESS_LEVELS.none;
  if (allowed.length === 1 && allowed[0] === "read") return ACCESS_LEVELS.view;
  if (allowed.length === available.length) return ACCESS_LEVELS.full;
  return ACCESS_LEVELS.partial;
};

export interface IRolesData {
  modules: IRoleModule[];
  roles: IRole[];
}

/** Every role with its permissions in this tenant, plus the modules. Needs Roles & Permissions read. */
export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get<IApiResponse<IRolesData>>("/roles")).data.data,
    enabled,
    staleTime: Infinity,
  });
}

// Badge colors by the role's place in GET /roles (sorted from most to least access), so new or
// renamed roles still get one; past the end, grey.
const ROLE_COLORS = ["primary", "violet", "green", "orange", "gray"];

export const roleColor = (roles: { code?: string }[] | undefined, code: string) => {
  const index = roles?.findIndex((role) => role.code === code) ?? -1;
  return ROLE_COLORS[index] ?? "gray";
};

// Icons the same way (user form role cards, Roles & Permissions page); past the end, a plain user.
const ROLE_ICONS = [IconShieldCheck, IconSettings, IconBriefcase, IconClipboardCheck, IconEye];

export const roleIcon = (roles: { code?: string }[] | undefined, code: string) =>
  ROLE_ICONS[roles?.findIndex((role) => role.code === code) ?? -1] ?? IconUser;

/** Saves the modules sent (each with all four switches); the others stay as they are. */
export function useSaveRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permissions }: { id: number; permissions: TPermissions }) =>
      (await api.put<IApiResponse<IRole>>(`/roles/${id}/permissions`, { permissions })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      // The logged in user's own role may have changed: menus and buttons follow /auth/me.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/** Reset to defaults: drops this institution's changes to a role (only a customized one). */
export function useResetRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<IApiResponse<IRole>>(`/roles/${id}/permissions/reset`)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/** "super_admin" -> "Super Admin", where only the code is known (e.g. the dev user switcher). */
export const roleLabelFromCode = (code: string) =>
  code
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
