// Mirrors the success / error bodies of firmli-ai-offer-letter-backend.
export interface IApiResponse<T = unknown> {
  statusCode: number;
  data: T;
  message: string;
  success: true;
}

export interface IApiError {
  statusCode: number;
  data: null;
  message: string;
  success: false;
  // 422: field name -> message ("address.city" for nested fields). Otherwise [{ message }] or [].
  errors?: Record<string, string> | { message: string }[];
  // A fixed name for errors the app must act on (lib/errors.ts TErrorCode); null on every other error.
  code?: string | null;
  // Local dev only. Never show it to users.
  stack?: string;
}

// One choice of an options endpoint ({value, label}), e.g. a status and its label.
export interface IOption<T extends string = string> {
  value: T;
  label: string;
}

// data of a paginated list endpoint. Pages = Math.ceil(total / limit).
export interface IPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IHealthStatus {
  service: string;
  uptime: number;
  database: "up" | "down" | "not_configured";
  queue?: "up" | "down" | "not_configured"; // the Redis job queue that runs AI assessments
}
