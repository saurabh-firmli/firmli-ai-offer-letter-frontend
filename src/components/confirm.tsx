import { ReactNode } from "react";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";

interface IConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/** Confirm dialog for a destructive action (delete, discard): danger + secondary buttons. */
export function confirmDanger({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: IConfirmOptions) {
  modals.openConfirmModal({
    title,
    children: <Text size="sm">{message}</Text>,
    labels: { confirm: confirmLabel, cancel: cancelLabel },
    confirmProps: { variant: "danger" },
    cancelProps: { variant: "secondary" },
    onConfirm,
  });
}
