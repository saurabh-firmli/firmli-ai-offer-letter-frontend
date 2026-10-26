import { Button, Group } from "@mantine/core";

interface IFormActionsProps {
  onCancel: () => void;
  submitLabel: string; // "Create X" for a new item, "Save Changes" when editing
  loading?: boolean;
  disabled?: boolean; // e.g. until a removal is confirmed by typing the name
}

/** Cancel + submit at the end of every form, right aligned. Goes inside the <form>. */
export default function FormActions({ onCancel, submitLabel, loading, disabled }: IFormActionsProps) {
  return (
    <Group justify="flex-end" gap="sm" wrap="nowrap">
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" loading={loading} disabled={disabled}>
        {submitLabel}
      </Button>
    </Group>
  );
}
