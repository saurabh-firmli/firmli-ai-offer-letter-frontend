// Mirrors ApiResponse / ApiError of firmli-ai-offer-letter-backend.
export interface IApiResponse<T = unknown> {
  statusCode: number;
  statusInfo: { statusCode?: number; statusMessage?: string };
  data: T;
  message: string;
  success: boolean;
}

export interface IApiError {
  statusCode: number;
  message: string;
  errors?: { message: string; [key: string]: unknown }[];
  success: false;
}

export interface IHealthStatus {
  service: string;
  uptime: number;
  database: "up" | "down" | "not_configured";
}
