import { FocusEvent, useRef } from "react";
import { UseFormReturnType } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { BLOCK_VARIABLES, insertVariableText } from "./letterTemplates";

type TFieldElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * "Insert variable" for the letter and email template forms: puts {{key}} at the cursor of the
 * last field the user was in (`defaultField` until then). Spread `fieldProps(name)` on every field
 * that may use variables; `oneLineFields` (the subject) refuse block variables (tables / lists).
 */
export function useVariableInsertion<T extends Record<string, unknown>, F extends keyof T & string>(
  form: UseFormReturnType<T>,
  defaultField: F,
  oneLineFields: F[] = []
) {
  const elements = useRef<Partial<Record<F, TFieldElement | null>>>({});
  const lastField = useRef<F>(defaultField);

  const fieldProps = (field: F) => {
    const inputProps = form.getInputProps(field);
    return {
      ...inputProps,
      ref: (element: TFieldElement | null) => {
        elements.current[field] = element;
      },
      onFocus: (event: FocusEvent) => {
        lastField.current = field;
        inputProps.onFocus?.(event);
      },
    };
  };

  const insert = (key: string | null) => {
    if (!key) return;
    const field = lastField.current;
    if (BLOCK_VARIABLES.has(key) && oneLineFields.includes(field)) {
      notifications.show({
        color: "orange",
        title: "Not in the subject",
        message: "Tables and lists go in the body, on a line of their own.",
      });
      return;
    }
    const element = elements.current[field];
    const value = String(form.getValues()[field] ?? "");
    const inserted = insertVariableText(
      value,
      element?.selectionStart ?? value.length,
      element?.selectionEnd ?? value.length,
      key
    );
    form.setFieldValue(field, inserted.value as never);
    // Back to the field, with the cursor right after the inserted variable.
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(inserted.cursor, inserted.cursor);
    });
  };

  return { fieldProps, insert };
}
