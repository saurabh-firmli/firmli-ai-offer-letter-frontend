import { Select, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import OptionCards from "../components/OptionCards";
import { IDocumentRequirement, IEligibilityOptions, useSaveDocument } from "../lib/eligibility";
import { applyFormError, useResetOnOpen } from "../lib/forms";

type TFormValues = {
  documentTypeId: string | null;
  customLabel: string;
  instructions: string;
  isRequired: "true" | "false"; // OptionCards values are strings
};

const toFormValues = (document: IDocumentRequirement | null): TFormValues => ({
  documentTypeId: document ? String(document.documentTypeId) : null,
  customLabel: document?.customLabel ?? "",
  instructions: document?.instructions ?? "",
  isRequired: document?.isRequired === false ? "false" : "true",
});

interface IDocumentRequirementFormProps {
  opened: boolean;
  versionId: number;
  document: IDocumentRequirement | null; // null = add a new one
  usedTypeIds: number[]; // each document type once per version
  options: IEligibilityOptions | undefined;
  onClose: () => void;
}

export default function DocumentRequirementForm({
  opened,
  versionId,
  document,
  usedTypeIds,
  options,
  onClose,
}: IDocumentRequirementFormProps) {
  const save = useSaveDocument();
  const form = useForm<TFormValues>({
    initialValues: toFormValues(null),
    validate: { documentTypeId: (value) => (value ? null : "Select a document type") },
  });

  useResetOnOpen(form, opened, document, toFormValues(document));

  // Types already in the list are left out (the edited one stays).
  const typeOptions = (options?.documentTypes ?? [])
    .filter(({ id }) => id === document?.documentTypeId || !usedTypeIds.includes(id))
    .map(({ id, label }) => ({ value: String(id), label }));

  const handleSubmit = form.onSubmit((values) =>
    save.mutate(
      {
        id: document?.id,
        versionId,
        documentTypeId: Number(values.documentTypeId),
        customLabel: values.customLabel,
        instructions: values.instructions,
        isRequired: values.isRequired === "true",
      },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: document ? "Document requirement updated" : "Document requirement created",
            message: saved.customLabel || saved.documentType,
          });
          onClose();
        },
        // 409 = this document type is already in the list.
        onError: (error) =>
          applyFormError(form, error, {
            conflictField: "documentTypeId",
            toastTitle: "Could not save document",
          }),
      }
    )
  );

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={document ? "Edit Document Requirement" : "New Document Requirement"}
      description="A document every application for these programs has to include."
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <Select
            label="Document Type"
            placeholder={options ? "Select document type" : "Loading..."}
            withAsterisk
            data={typeOptions}
            nothingFoundMessage="Every document type is already in the list"
            {...form.getInputProps("documentTypeId")}
          />
          <TextInput
            label="Custom Label"
            placeholder="e.g. Bachelor's Transcript"
            maxLength={150}
            {...form.getInputProps("customLabel")}
          />
          <TextInput
            label="Instructions"
            placeholder="e.g. Must be official"
            maxLength={500}
            {...form.getInputProps("instructions")}
          />
          <OptionCards
            label="Requirement"
            data={[
              { value: "true", label: "Required" },
              { value: "false", label: "Optional" },
            ]}
            value={form.values.isRequired}
            onChange={(value) => form.setFieldValue("isRequired", value as "true" | "false")}
          />
          <FormActions
            onCancel={onClose}
            submitLabel={document ? "Save Changes" : "Create Document Requirement"}
            loading={save.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}
