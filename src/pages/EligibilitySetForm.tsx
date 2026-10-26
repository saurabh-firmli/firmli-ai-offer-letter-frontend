import { Stack, TextInput, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import { IEligibilitySetSummary, useSaveSet } from "../lib/eligibility";
import { applyFormError, useResetOnOpen } from "../lib/forms";

interface IEligibilitySetFormProps {
  opened: boolean;
  set: IEligibilitySetSummary | null; // null = create a new one
  onClose: () => void;
  onSaved?: (set: IEligibilitySetSummary) => void;
}

export default function EligibilitySetForm({ opened, set, onClose, onSaved }: IEligibilitySetFormProps) {
  const save = useSaveSet();
  const form = useForm({
    initialValues: { name: "", description: "" },
    validate: { name: (value) => (value.trim() ? null : "Set name is required") },
  });

  useResetOnOpen(form, opened, set, { name: set?.name ?? "", description: set?.description ?? "" });

  const handleSubmit = form.onSubmit((values) =>
    save.mutate(
      { id: set?.id, ...values },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: set ? "Eligibility set updated" : "Eligibility set created",
            message: saved.name,
          });
          onSaved?.(saved);
          onClose();
        },
        // 409 = this name already exists in the tenant.
        onError: (error) =>
          applyFormError(form, error, { conflictField: "name", toastTitle: "Could not save set" }),
      }
    )
  );

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={set ? "Edit Eligibility Set" : "New Eligibility Set"}
      description={
        set
          ? set.name
          : "A set of admission rules that several programs can share. It starts with an empty draft v1."
      }
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Set Name"
            placeholder="e.g. UK Masters Standard"
            withAsterisk
            maxLength={150}
            data-autofocus
            {...form.getInputProps("name")}
          />
          <Textarea
            label="Description"
            placeholder="e.g. Common rules for taught masters programs"
            autosize
            minRows={2}
            maxRows={6}
            {...form.getInputProps("description")}
          />
          <FormActions
            onCancel={onClose}
            submitLabel={set ? "Save Changes" : "Create Eligibility Set"}
            loading={save.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}
