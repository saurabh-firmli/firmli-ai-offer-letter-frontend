// Every route path lives here. Use these constants instead of string literals.
export const RO_HOME = "/";
export const RO_DASHBOARD = "/dashboard";
export const RO_APPLICATIONS = "/applications";
export const RO_NEW_APPLICATION = "/applications/new";
export const RO_APPLICATION = "/applications/:id";
export const RO_EDIT_APPLICATION = "/applications/:id/edit";

/** /applications/12 and /applications/12/edit for one application. */
export const applicationPath = (id: number) => `/applications/${id}`;
export const editApplicationPath = (id: number) => `/applications/${id}/edit`;
export const RO_MANUAL_REVIEW = "/manual-review";
export const RO_PROGRAMS = "/programs";
export const RO_CAMPUSES = "/campuses";
export const RO_ELIGIBILITY_CRITERIA = "/eligibility-criteria";
export const RO_ELIGIBILITY_SET = "/eligibility-criteria/:id";
/** /eligibility-criteria/3 for one eligibility set. */
export const eligibilitySetPath = (id: number) => `/eligibility-criteria/${id}`;
export const RO_LETTERS = "/letters"; // ?status=pending_approval from the bell
export const RO_LETTER_TEMPLATES = "/letter-templates";
export const RO_EMAIL_TEMPLATES = "/email-templates";
export const RO_COMMUNICATIONS = "/communications"; // ?status=failed from the bell
export const RO_REPORTS = "/reports";
export const RO_AUDIT_LOG = "/audit-log";
export const RO_AI_USAGE = "/ai-usage";
export const RO_USERS = "/users";
export const RO_ROLES = "/roles";
export const RO_SETTINGS = "/settings";
export const RO_PROFILE = "/profile"; // my account, password and sessions
export const RO_PLATFORM = "/platform"; // Firmli staff only: the client tenants
export const RO_LOGIN = "/login";
export const RO_FORGOT_PASSWORD = "/forgot-password";
export const RO_RESET_PASSWORD = "/reset-password"; // the link in the reset email: ?token=...
