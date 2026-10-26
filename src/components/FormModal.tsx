import { ReactNode } from "react";
import { Modal } from "@mantine/core";
import FormHeader from "./FormHeader";

interface IFormModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  size?: number; // wider for a details view (audit log changes)
  children: ReactNode;
}

/**
 * The modal for every small create / edit form (campus, user) and read-only details (an audit log entry).
 * Long forms use a drawer (ProgramForm).
 */
export default function FormModal({
  opened,
  onClose,
  title,
  description,
  size = 520,
  children,
}: IFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      radius="lg"
      padding="xl"
      size={size}
      title={<FormHeader title={title} description={description} />}
    >
      {children}
    </Modal>
  );
}
