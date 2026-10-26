import { useMutation, useQuery } from "@tanstack/react-query";
import api from "./api";
import { live } from "./live";
import { queryClient } from "./queryClient";
import { clearSessionData, getToken, setStaffToken, setToken, signOut } from "./session";
import type { IRoleModule } from "./roles";
import { IApiResponse } from "../types";
import { RO_DASHBOARD } from "../routes";

/** The modules permissions are given for (the codes of GET /roles `modules`). */
export type TModule =
  | "applications"
  | "reviews" // Manual Review: read and update only
  | "letters" // generated letters: create = generate, update = approve / reject
  | "communications" // emails to students: create = send a letter, update = retry
  | "programs"
  | "campuses"
  | "letter_templates"
  | "email_templates"
  | "eligibility"
  | "users"
  | "roles" // Roles & Permissions: read and update only
  | "settings" // the company's settings: read and update only
  | "ai_usage" // AI Usage: read only
  | "audit_logs"; // read only
export type TAction = "create" | "read" | "update" | "delete";

/** A module missing from the map can't be used at all. */
export type TPermissions = Partial<Record<TModule, Record<TAction, boolean>>>;

// active and inactive can log in: a new user starts inactive ("has not logged in yet") and their
// first login makes them active. The other four lock the user out the same way; they differ only in
// the label the team picks (deleted keeps the user in the list, unlike DELETE).
export type TUserStatus = "active" | "inactive" | "banned" | "blocked" | "deactivated" | "deleted";

export const userStatusLabels: Record<TUserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  banned: "Banned",
  blocked: "Blocked",
  deactivated: "Deactivated",
  deleted: "Deleted",
};

/** Whether the user may log in (and their token works). */
export const canLogIn = (status: TUserStatus) => status === "active" || status === "inactive";

export const userStatusColors: Record<TUserStatus, string> = {
  active: "green",
  inactive: "gray",
  banned: "red",
  blocked: "orange",
  deactivated: "yellow",
  deleted: "dark",
};

// Every user belongs to one tenant (client company); the backend scopes all data to it.
export interface IUser {
  id: number;
  tenantId: number;
  name: string;
  email: string;
  roleId: number;
  role: string; // the role code, e.g. super_admin
  roleName: string; // its label, e.g. "Admissions Officer"
  status: TUserStatus;
  lastLoginAt: string | null; // null = never logged in
  createdAt: string;
  updatedAt: string;
  tenant?: { id: number; name: string; isPlatform?: boolean }; // only on login and /auth/me; isPlatform = Firmli staff
  permissions?: TPermissions; // only on login and /auth/me
  // Only on GET /auth/me: every module with the actions it has (Audit Logs only read, ...), so the
  // Profile's Your Access needs no hard-coded list and no Roles read.
  modules?: IRoleModule[];
}

export interface ILoginInput {
  email: string;
  password: string;
}

/**
 * The logged in user, with their role's permissions. Also checks on app load that the stored token
 * still works. Re-read when the tab gets focus again, so a changed role soon shows in the menus.
 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<IApiResponse<IUser>>("/auth/me");
      return data.data;
    },
    enabled: Boolean(getToken()),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * can("programs", "create"): whether the logged in user's role allows it. Use it to hide menus and
 * buttons; the API still refuses (403) whatever the role may not do.
 */
export function useCan() {
  const { data: user } = useMe();
  return (module: TModule, action: TAction) => Boolean(user?.permissions?.[module]?.[action]);
}

// There is no signup: the Firmli team creates each tenant and its first admin, who adds the rest.
export function useLogin() {
  return useMutation({
    mutationFn: async (body: ILoginInput) => {
      const { data } = await api.post<IApiResponse<{ user: IUser; token: string }>>("/auth/login", body);
      return data.data;
    },
    onSuccess: startSession,
  });
}

/** A new login (login, reset password): nothing from a previous session may show for this user. */
function startSession({ user, token }: { user: IUser; token: string }) {
  clearSessionData();
  setStaffToken(null); // a fresh login is never a staff switch (lib/session.ts keeps its token per tab)
  setToken(token);
  queryClient.setQueryData(["me"], user);
  // The login answer has no `modules` (only GET /auth/me does): fetch it once in the background.
  void queryClient.invalidateQueries({ queryKey: ["me"] });
}

// A user from an answer without `modules` keeps the ones already loaded.
const keepModules = (user: IUser) => (old: IUser | undefined) => ({
  ...user,
  modules: user.modules ?? old?.modules,
});

/**
 * Logout ends every token of the user (all their devices), then drops this one. A token that
 * already stopped working is fine: the user is logged out either way. Firmli staff switched into a
 * client's user log out with their own token, so the client's sessions stay as they are.
 */
export async function logOut() {
  live.stop(); // before the token goes, so the stream asks for no new ticket
  try {
    await api.post("/auth/logout");
  } catch {
    // Already logged out on the server.
  }
  signOut("logout");
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

/** Change my own password. This device gets a new token and stays logged in; the others are logged out. */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) =>
      (await api.post<IApiResponse<{ user: IUser; token: string }>>("/auth/change-password", body)).data.data,
    onSuccess: ({ user, token }) => {
      setToken(token);
      queryClient.setQueryData(["me"], keepModules(user));
    },
  });
}

export const NAME_MAX = 150;

/** Change my own name (only the name; email, role and status are an admin's). The token stays. */
export function useUpdateMyName() {
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.patch<IApiResponse<IUser>>("/auth/me", { name })).data.data,
    onSuccess: (user) => queryClient.setQueryData(["me"], keepModules(user)),
  });
}

/** Always answers with the same message, whether or not the email has an account. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post<IApiResponse<null>>("/auth/forgot-password", { email })).data.message,
  });
}

/** Checks a reset link before the form shows: the email of its account, or 400 when invalid or expired. */
export function useVerifyResetToken(token: string | null) {
  return useQuery({
    queryKey: ["reset-password", token],
    queryFn: async () =>
      (await api.post<IApiResponse<{ email: string }>>("/auth/reset-password/verify", { token })).data.data,
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
}

/** Sets the new password with the link; answers like login, so the user is logged in. */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (body: { token: string; password: string }) =>
      (await api.post<IApiResponse<{ user: IUser; token: string }>>("/auth/reset-password", body)).data.data,
    onSuccess: startSession,
  });
}

// ?next= holds the page the user wanted before being sent to login.
// Only same-site paths are followed, so the link can't send anyone to another site.
export const getNextPath = (searchParams: URLSearchParams) => {
  const next = searchParams.get("next");
  if (!next || !next.startsWith("/")) return RO_DASHBOARD;
  // Let the browser's own parser decide: it reads "/\evil.com" or "/\t/evil.com" as "//evil.com".
  try {
    const url = new URL(next, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : RO_DASHBOARD;
  } catch {
    return RO_DASHBOARD;
  }
};

/** "Saurabh Kumar" -> "SK" */
export const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
