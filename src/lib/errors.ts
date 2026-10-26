import { isAxiosError } from "axios";
import { notifications } from "@mantine/notifications";
import { IApiError } from "../types";

export type TErrorKind = "offline" | "timeout" | "server" | "forbidden" | "notFound" | "other";

const OFFLINE = "You're offline. Check your internet connection; the page reloads once you're back.";
const UNREACHABLE = "Can't reach the server right now. It may be restarting; try again in a moment.";
const TIMEOUT = "The server took too long to answer. Try again in a moment.";
const SERVER =
  "Something went wrong on our side. Try again; if it keeps happening, send the request ID to support.";

/**
 * What kind of failure it was, in words a user can act on. Requests that never got an answer (no
 * network, server down, timeout) have no API message, so they get one here; a 500 gets a friendly
 * one with its request id; everything else keeps the API's own message.
 */
export function describeError(error: unknown): { kind: TErrorKind; message: string; requestId?: string } {
  if (isAxiosError<IApiError>(error)) {
    if (!error.response) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
        return { kind: "timeout", message: TIMEOUT };
      return { kind: "offline", message: navigator.onLine ? UNREACHABLE : OFFLINE };
    }
    const { status } = error.response;
    const requestId = error.response.headers?.["x-request-id"] as string | undefined;
    // 502 / 503 say what is missing ("Email is not configured"); a 500 never says anything useful.
    if (status === 500) return { kind: "server", message: SERVER, requestId };
    const kind: TErrorKind =
      status >= 500 ? "server" : status === 403 ? "forbidden" : status === 404 ? "notFound" : "other";
    return { kind, message: getErrorMessage(error), requestId: status >= 500 ? requestId : undefined };
  }
  return { kind: "other", message: getErrorMessage(error) };
}

/**
 * The API's fixed names for errors the app acts on. Decide with these, never by reading the message
 * text, which may be reworded.
 */
export type TErrorCode =
  | "LOGIN_REQUIRED" // no token sent
  | "SESSION_ENDED" // token invalid or expired, logged out, password changed, user deleted
  | "TENANT_BLOCKED" // Firmli blocked the institution (401 on any call, 403 on login, 409 on a switch)
  | "ACCOUNT_NOT_ACTIVE" // the user is blocked, banned, deactivated or deleted
  | "EVENTS_TICKET_INVALID"; // the live updates ticket expired

/** The error's code, or null (most errors have none). */
export const getErrorCode = (error: unknown): TErrorCode | null =>
  isAxiosError<IApiError>(error)
    ? ((error.response?.data?.code as TErrorCode | null | undefined) ?? null)
    : null;

/** Turns any thrown value into a single readable message. */
export const getErrorMessage = (error: unknown): string => {
  if (isAxiosError<IApiError>(error)) {
    // No answer at all: axios only says "Network Error" / "timeout of 30000ms exceeded".
    if (!error.response) return describeError(error).message;
    const body = error.response?.data;
    const errors = body?.errors;
    const first = Array.isArray(errors) ? errors[0]?.message : Object.values(errors ?? {})[0];
    return first || body?.message || error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
};

/**
 * Field errors of a 422, keyed by the field names that were sent ("address.city" for
 * nested ones). Empty for any other error. Pass the result to a form's setErrors().
 */
export const getFieldErrors = (error: unknown): Record<string, string> => {
  if (!isAxiosError<IApiError>(error) || error.response?.status !== 422) return {};
  const errors = error.response.data?.errors;
  return errors && !Array.isArray(errors) ? errors : {};
};

/**
 * A file request (responseType "blob") gets its error body as a blob too: turn it back into the
 * API's JSON so the usual messages and codes work. Not JSON: the error keeps its status. Returns the
 * same error, to rethrow.
 */
export async function withJsonErrorBody(error: unknown) {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text());
    } catch {
      // Not JSON: a general message shows.
    }
  }
  return error;
}

/**
 * Shows the error as a notification, in the same words as ErrorState (describeError). Use in mutation
 * onError handlers. A server error carries its request id, so a bug report can be traced in the logs.
 */
export default function errorHandler(error: unknown, title = "Error") {
  const { message, requestId } = describeError(error);
  notifications.show({
    color: "red",
    title,
    message: requestId ? `${message} Request ID: ${requestId}` : message,
  });
}
