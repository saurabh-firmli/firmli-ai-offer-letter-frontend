import { isAxiosError } from "axios";
import { notifications } from "@mantine/notifications";
import { IApiError } from "../types";

/** Turns any thrown value into a single readable message. */
export const getErrorMessage = (error: unknown): string => {
  if (isAxiosError<IApiError>(error)) {
    const body = error.response?.data;
    const first = body?.errors?.[0]?.message;
    return first || body?.message || error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
};

/** Shows the error as a notification. Use in mutation onError handlers. */
export default function errorHandler(error: unknown, title = "Error") {
  notifications.show({
    color: "red",
    title,
    message: getErrorMessage(error),
  });
}
