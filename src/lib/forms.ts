import { useEffect } from "react";
import { UseFormReturnType } from "@mantine/form";
import { isAxiosError } from "axios";
import errorHandler, { getErrorMessage, getFieldErrors } from "./errors";

/**
 * Loads `values` into a form every time its modal / drawer opens (and resets errors).
 * `record` is the item being edited (null = new); a different record reloads the form.
 */
export function useResetOnOpen<T extends Record<string, unknown>>(
  form: UseFormReturnType<T>,
  opened: boolean,
  record: unknown,
  values: T
) {
  useEffect(() => {
    if (!opened) return;
    form.setInitialValues(values);
    form.reset();
    // Only on open or a new record: form and values are new objects on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, record]);
}

/**
 * Puts a failed save on the form: a 409 under `conflictField` (e.g. a duplicate code),
 * 422 messages under their fields, anything else in a toast. `fieldMap` renames API fields whose
 * form field has another name ("admin.email" -> "adminEmail").
 */
export function applyFormError<T extends Record<string, unknown>>(
  form: UseFormReturnType<T>,
  error: unknown,
  {
    conflictField,
    fieldMap = {},
    toastTitle,
  }: { conflictField?: keyof T & string; fieldMap?: Record<string, keyof T & string>; toastTitle: string }
) {
  if (conflictField && isAxiosError(error) && error.response?.status === 409) {
    form.setFieldError(conflictField, getErrorMessage(error));
    return;
  }

  const fieldErrors = Object.fromEntries(
    Object.entries(getFieldErrors(error)).map(([field, message]) => [fieldMap[field] ?? field, message])
  );
  // A nested field comes back with a dotted path ("student.firstName"); its first part is the form's.
  if (Object.keys(fieldErrors).some((key) => key.split(".")[0] in form.getValues()))
    form.setErrors(fieldErrors);
  else errorHandler(error, toastTitle);
}

/**
 * For forms kept in useState rather than useForm: puts a 422 message for one of `fields` through
 * its setter. Returns true when it did, so the caller can toast anything else instead.
 */
export function applyFormErrorMessages(error: unknown, fields: Record<string, (message: string) => void>) {
  const fieldErrors = getFieldErrors(error);
  const matched = Object.keys(fields).filter((field) => fieldErrors[field]);
  matched.forEach((field) => fields[field](fieldErrors[field]));
  return matched.length > 0;
}

/**
 * For fields that hold someone else's details (a student's, a new user's): the browser's address
 * autofill and password managers would offer your own name and address, so they are turned off.
 * Chrome ignores autocomplete="off" for address autofill (it guesses from the labels), but it never
 * offers an address for a field marked "new-password"; on a text field that shows no password popup.
 */
export const NO_AUTOFILL = {
  autoComplete: "new-password",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;
