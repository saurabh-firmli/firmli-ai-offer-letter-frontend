import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "./api";
import { TModule } from "./auth";
import { IApiResponse, IPage } from "../types";
import { formatDate, formatDateTime } from "./utils";

// Every create / update / delete is logged by the backend; read only here. The Super Admin sees the
// whole tenant's changes, every other role only their own (the API filters, not the frontend).

export type TAuditAction = "create" | "update" | "delete";

export interface IAuditLog {
  id: number;
  module: TModule;
  action: TAuditAction;
  entityType: string; // program, letterTemplate, eligibilitySetVersion, ...
  entityId: number;
  entityLabel: string | null; // the record's name at the time, e.g. "MSDS - MSc Data Science"
  changes: Record<string, IChange>; // create: every from is null; delete: every to
  userId: number | null; // null = the system (e.g. the tenant's first Super Admin)
  userName: string | null;
  ipAddress: string | null;
  requestId: string | null; // logs of one click share it
  createdAt: string;
}

export interface IAuditLogFilters {
  page?: number;
  limit?: number;
  module?: string;
  action?: TAuditAction;
  from?: string; // YYYY-MM-DD, UTC, included
  to?: string;
  search?: string; // the record's label or the user's name
}

export interface IAuditLogOptions {
  modules: { code: TModule; name: string }[];
  actions: { value: TAuditAction; label: string }[];
}

export function useAuditLogs(filters: IAuditLogFilters) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () =>
      (await api.get<IApiResponse<IPage<IAuditLog>>>("/audit-logs", { params: filters })).data.data,
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

/** The Module and Action filter values. */
export function useAuditLogOptions() {
  return useQuery({
    queryKey: ["audit-logs", "options"],
    queryFn: async () => (await api.get<IApiResponse<IAuditLogOptions>>("/audit-logs/options")).data.data,
    staleTime: Infinity,
  });
}

export const auditActionLabels: Record<TAuditAction, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

export const auditActionColors: Record<TAuditAction, string> = {
  create: "green",
  update: "primary",
  delete: "red",
};

const entityTypeLabels: Record<string, string> = {
  program: "Program",
  campus: "Campus",
  letterTemplate: "Letter Template",
  emailTemplate: "Email Template",
  user: "User",
  eligibilitySet: "Eligibility Set",
  eligibilitySetVersion: "Eligibility Version",
  eligibilityCriterion: "Criterion",
  eligibilityCriterionDocument: "Criterion Document",
  eligibilityDocumentRequirement: "Document Requirement",
  role: "Role",
  settings: "Settings",
  application: "Application",
  student: "Student",
  applicationDocument: "Application Document",
  manualReview: "Manual Review",
  applicationDocumentRequest: "Document Request",
  applicationNote: "Note",
  assessmentCriterion: "Criterion Override",
  applicationLetter: "Letter",
};

// "letterTemplate" -> "Letter Template"; also for field names: "applicationDeadline" -> "Application Deadline".
const humanize = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\bId(s?)\b/g, "ID$1")
    .replace(/^./, (c) => c.toUpperCase());

export const entityTypeLabel = (type: string) => entityTypeLabels[type] ?? humanize(type);

const fieldLabels: Record<string, string> = {
  passwordHash: "Password",
  openaiApiKey: "OpenAI API Key",
  smtpPassword: "SMTP Password",
};

// Short words that read as capitals: "Smtp Host" -> "SMTP Host", "Attach Pdf Letter" -> "Attach PDF Letter".
const ACRONYMS: Record<string, string> = {
  Smtp: "SMTP",
  Ai: "AI",
  Pdf: "PDF",
  Url: "URL",
  Cc: "CC",
  Bcc: "BCC",
};
const withAcronyms = (label: string) => label.replace(/\b[A-Z][a-z]+\b/g, (word) => ACRONYMS[word] ?? word);

// Secrets come as "***": say what happened to them, never a value.
const SECRET_FIELDS = ["passwordHash", "openaiApiKey", "smtpPassword"];

/**
 * One changed field. A user id (reviewerId, submittedBy, ...) comes with the user's name from the
 * API (fromName / toName), in the audit log and in an application's Activity alike.
 */
export interface IChange {
  from: unknown;
  to: unknown;
  fromName?: string | null;
  toName?: string | null;
}

// Fields that hold a user's id ("assignedBy": 19); without a name from the API it shows "User #19".
const isUserField = (field: string) =>
  /[a-z]By$/.test(field) || ["userId", "reviewerId", "officerId", "defaultReviewerId"].includes(field);

// A role's permission change is logged per switch: "letter_templates.delete" -> "Letter Templates › Delete".
const titleCase = (text: string) => text.replace(/\b[a-z]/g, (c) => c.toUpperCase());

// A reference to another record ("campusId"); its value shows as "#3".
const isIdField = (field: string) => /[a-z]Id$/.test(field);

/** "applicationDeadline" -> "Application Deadline"; "campusId" -> "Campus" (the value says "#3"). */
export const fieldLabel = (field: string) =>
  fieldLabels[field] ??
  withAcronyms(
    field.includes(".")
      ? field
          .split(".")
          .map((part) => titleCase(humanize(part)))
          .join(" › ")
      : titleCase(humanize(isIdField(field) ? field.slice(0, -2) : field))
  );

// Same in every log of a tenant, so it says nothing.
const HIDDEN_FIELDS = ["tenantId"];

/** The changed fields worth showing, in a stable order. */
export const visibleChanges = (log: IAuditLog) =>
  Object.entries(log.changes ?? {})
    .filter(([field]) => !HIDDEN_FIELDS.includes(field))
    .sort(([a], [b]) => a.localeCompare(b));

// Fields that hold an API enum ("full_time"), shown as its words ("Full Time").
const ENUM_FIELDS = [
  "status",
  "studyMode",
  "letterType",
  "emailType",
  "dataType",
  "operator",
  "gender",
  "intakeTerm",
  "assessmentStatus",
  "outcome",
  "priority",
  "resolution",
  "emailStatus",
];

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);

// Timestamps ("2026-10-24T16:48:21.727Z") and dates ("2026-12-31") as the app shows them elsewhere.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A logged value as text: "—" for empty, Yes / No, a user's name (the API's, or "User #19"), "#3" for
 * another record's id, a readable date, "Full Time" for an enum.
 */
export const formatChangeValue = (value: unknown, field = "", name?: string | null): string => {
  if (isEmpty(value)) return "—";
  if (SECRET_FIELDS.includes(field)) return "Hidden";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && isUserField(field)) return name || `User #${value}`;
  if (typeof value === "number" && isIdField(field)) return `#${value}`;
  if (typeof value === "string" && TIMESTAMP.test(value)) return formatDateTime(value);
  if (typeof value === "string" && DAY.test(value)) return formatDate(value);
  if (typeof value === "string" && ENUM_FIELDS.includes(field)) return titleCase(humanize(value));
  if (Array.isArray(value)) return value.map((item) => formatChangeValue(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const shorten = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * One changed field of an update, for the table, in words: a value that was empty is "set",
 * one that became empty is "cleared", anything else goes from -> to.
 */
export type TChange =
  | { kind: "password"; label: string }
  | { kind: "secret"; label: string; what: "added" | "removed" | "changed" }
  | { kind: "set"; label: string; to: string }
  | { kind: "cleared"; label: string }
  | { kind: "changed"; label: string; from: string; to: string };

export const describeChange = (field: string, { from, to, fromName, toName }: IChange): TChange => {
  const label = fieldLabel(field);
  if (field === "passwordHash") return { kind: "password", label };
  if (SECRET_FIELDS.includes(field))
    return { kind: "secret", label, what: isEmpty(from) ? "added" : isEmpty(to) ? "removed" : "changed" };
  if (isEmpty(from)) return { kind: "set", label, to: shorten(formatChangeValue(to, field, toName)) };
  if (isEmpty(to)) return { kind: "cleared", label };
  return {
    kind: "changed",
    label,
    from: shorten(formatChangeValue(from, field, fromName)),
    to: shorten(formatChangeValue(to, field, toName)),
  };
};
