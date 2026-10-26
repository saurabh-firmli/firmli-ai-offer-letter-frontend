import { useQuery } from "@tanstack/react-query";
import api from "./api";
import { IApiResponse } from "../types";

// Options for select boxes (GET /dropdowns/<name>): {value, label}, sorted by label, this institution
// only. Any logged in user may load them, so a form never needs a module permission just to fill a
// select, and there is no page limit. Send value back to the API; show label.

export interface IDropdownOption {
  value: number;
  label: string; // e.g. "MSc Data Science (MSDS)", "Main Campus (Pune)"
  code?: string; // roles: "super_admin", ...
  eligibilitySet?: { id: number; name: string } | null; // programs with withEligibilitySet=true
}

export type TDropdown =
  "programs" | "campuses" | "eligibility-sets" | "letter-templates" | "email-templates" | "users" | "roles";

// Each dropdown is cached under its module's key, so saving a program, campus, set or template
// (which refreshes that module) refreshes its dropdown too.
const MODULE_KEY: Record<TDropdown, string> = {
  programs: "programs",
  campuses: "campuses",
  "eligibility-sets": "eligibility",
  "letter-templates": "letter-templates",
  "email-templates": "email-templates",
  users: "users",
  roles: "roles",
};

/**
 * One dropdown's options. params narrow it: programs by status (withEligibilitySet=true adds each
 * one's set), eligibility sets by published=true, templates by letterType / emailType and status,
 * users by role and assignable=true; any of them by search. Roles come from Super Admin down.
 */
export function useDropdown(name: TDropdown, params: Record<string, string> = {}, enabled = true) {
  return useQuery({
    queryKey: [MODULE_KEY[name], "dropdown", name, params],
    queryFn: async () =>
      (await api.get<IApiResponse<IDropdownOption[]>>(`/dropdowns/${name}`, { params })).data.data,
    enabled,
    staleTime: 60_000,
  });
}

/** For Mantine selects, whose values are strings. */
export const toSelectData = (options: IDropdownOption[] = []) =>
  options.map(({ value, label }) => ({ value: String(value), label }));
