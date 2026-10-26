import { FormEvent, ReactNode } from "react";
import { Button, Drawer, Group } from "@mantine/core";
import { getHotkeyHandler } from "@mantine/hooks";
import FormActions from "./FormActions";
import FormHeader from "./FormHeader";
import { confirmDanger } from "./confirm";
import classes from "./FormDrawer.module.css";

interface IFormDrawerProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void; // form.onSubmit(...) from @mantine/form
  submitLabel: string; // "Create X" for a new item, "Save Changes" when editing
  loading?: boolean;
  isDirty?: boolean; // ask before closing with unsaved changes
  size?: number;
  readOnly?: boolean; // nothing to save (e.g. a resolved review case): only Close in the footer
  children: ReactNode; // FormSection blocks
}

/**
 * The right-hand drawer for every long create / edit form (program, letter template).
 * Small forms use FormModal. Header and footer stay put while the fields scroll;
 * Ctrl / Cmd + Enter saves.
 */
export default function FormDrawer({
  opened,
  onClose,
  title,
  description,
  onSubmit,
  submitLabel,
  loading,
  isDirty,
  size = 600,
  readOnly = false,
  children,
}: IFormDrawerProps) {
  const requestClose = () => {
    if (!isDirty) return onClose();
    confirmDanger({
      title: "Discard changes?",
      message: "Your changes have not been saved.",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      onConfirm: onClose,
    });
  };

  return (
    <Drawer.Root opened={opened} onClose={requestClose} position="right" size={size}>
      <Drawer.Overlay backgroundOpacity={0.35} blur={2} />
      <Drawer.Content>
        <form
          className={classes.form}
          onSubmit={onSubmit}
          onKeyDown={getHotkeyHandler([["mod+Enter", () => !readOnly && onSubmit()]])}
        >
          <Drawer.Header className={classes.header}>
            <Drawer.Title>
              <FormHeader title={title} description={description} />
            </Drawer.Title>
            <Drawer.CloseButton />
          </Drawer.Header>

          <Drawer.Body className={classes.body}>{children}</Drawer.Body>

          <div className={classes.footer}>
            {readOnly ? (
              <Group justify="flex-end">
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </Group>
            ) : (
              <FormActions onCancel={requestClose} submitLabel={submitLabel} loading={loading} />
            )}
          </div>
        </form>
      </Drawer.Content>
    </Drawer.Root>
  );
}
