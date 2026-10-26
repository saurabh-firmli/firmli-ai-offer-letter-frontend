import { ReactNode } from "react";
import { Button, Group, SimpleGrid, Switch, TextInput, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBraces,
  IconCircleCheck,
  IconCircleX,
  IconClipboardCheck,
  IconEye,
  IconFileUpload,
  IconMailCog,
} from "@tabler/icons-react";
import { isAxiosError } from "axios";
import FormDrawer from "../components/FormDrawer";
import FormSection from "../components/FormSection";
import { FormSkeleton } from "../components/Skeletons";
import OptionCards, { IOptionCard } from "../components/OptionCards";
import SearchableSelect from "../components/SearchableSelect";
import StatusDot from "../components/StatusDot";
import {
  IEmailTemplate,
  IEmailTemplateSummary,
  TEmailStatus,
  TEmailTemplateInput,
  TEmailType,
  emailStatusColors,
  emailStatusLabels,
  emailTypeLabels,
  hasLetter,
  useEmailTemplate,
  useEmailVariables,
  useSaveEmailTemplate,
} from "../lib/emailTemplates";
import { getErrorMessage } from "../lib/errors";
import { applyFormError, useResetOnOpen } from "../lib/forms";
import { toVariableOptions } from "../lib/letterTemplates";
import { useVariableInsertion } from "../lib/useVariableInsertion";
import { toOptions } from "../lib/utils";
import EmailPreview from "./EmailPreview";

type TFormValues = {
  name: string;
  emailType: TEmailType;
  subject: string;
  cc: string;
  bcc: string;
  body: string;
  attachPdfLetter: boolean;
  status: TEmailStatus;
};

// The API returns unset fields as null; text inputs want "" (which the API also accepts).
const toFormValues = (template: IEmailTemplate | null | undefined): TFormValues => ({
  name: template?.name ?? "",
  emailType: template?.emailType ?? "conditional_offer", // the most common email
  subject: template?.subject ?? "",
  cc: template?.cc ?? "",
  bcc: template?.bcc ?? "",
  body: template?.body ?? "",
  attachPdfLetter: template?.attachPdfLetter ?? true,
  status: template?.status ?? "draft",
});

// Types without a letter never attach one (the API refuses true for them).
const toBody = (values: TFormValues): TEmailTemplateInput => ({
  ...values,
  attachPdfLetter: hasLetter(values.emailType) && values.attachPdfLetter,
});

const emailTypeIcons: Record<TEmailType, ReactNode> = {
  conditional_offer: <IconCircleCheck size={16} />,
  rejection: <IconCircleX size={16} />,
  manual_review: <IconClipboardCheck size={16} />,
  document_request: <IconFileUpload size={16} />,
  custom: <IconMailCog size={16} />,
};

const emailTypeOptions: IOptionCard[] = toOptions(emailTypeLabels).map((option) => ({
  ...option,
  icon: emailTypeIcons[option.value as TEmailType],
}));

const statusOptions: IOptionCard[] = toOptions(emailStatusLabels).map((option) => ({
  ...option,
  icon: <StatusDot color={emailStatusColors[option.value as TEmailStatus]} />,
}));

interface IEmailTemplateFormProps {
  opened: boolean;
  template: IEmailTemplateSummary | null; // null = create a new one
  onClose: () => void;
}

export default function EmailTemplateForm({ opened, template, onClose }: IEmailTemplateFormProps) {
  const save = useSaveEmailTemplate();
  // The list has no body, so an edit loads the full template first.
  const detail = useEmailTemplate(opened && template ? template.id : null);
  const variables = useEmailVariables(opened);
  const [previewOpened, preview] = useDisclosure();
  const loadingTemplate = Boolean(template) && detail.isLoading;

  const form = useForm<TFormValues>({
    initialValues: toFormValues(null),
    validate: {
      name: (value) => (value.trim() ? null : "Template name is required"),
      body: (value) => (value.trim() ? null : "Body is required"),
    },
  });

  // New: a blank form. Edit: refills once the full template has loaded.
  useResetOnOpen(form, opened, template ? detail.data : "new", toFormValues(template ? detail.data : null));

  // "Insert variable" writes into the subject or body, wherever the cursor was.
  const { fieldProps: variableFieldProps, insert: insertVariable } = useVariableInsertion<
    TFormValues,
    "subject" | "body"
  >(form, "body", ["subject"]);

  const letterAvailable = hasLetter(form.values.emailType);

  // Switching between types with and without a letter sets the attachment to the API's default.
  const setEmailType = (emailType: TEmailType) =>
    form.setValues({ emailType, attachPdfLetter: hasLetter(emailType) });

  const handleSubmit = form.onSubmit((values) =>
    save.mutate(
      { id: template?.id, ...toBody(values) },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: template ? "Email template updated" : "Email template created",
            message: saved.name,
          });
          onClose();
        },
        onError: (error) => {
          // 409 is either a duplicate name or a type change on a template that programs use.
          if (isAxiosError(error) && error.response?.status === 409 && /type/i.test(getErrorMessage(error))) {
            form.setFieldError("emailType", getErrorMessage(error));
            return;
          }
          // 422: bad cc / bcc addresses or unknown {{variables}} come back under their field.
          applyFormError(form, error, { conflictField: "name", toastTitle: "Could not save template" });
        },
      }
    )
  );

  return (
    <>
      <FormDrawer
        opened={opened}
        onClose={onClose}
        title={template ? "Edit Email Template" : "New Email Template"}
        description={
          template
            ? `${template.name} · ${emailTypeLabels[template.emailType]}`
            : "Write the email once; {{variables}} are filled in for each student."
        }
        onSubmit={handleSubmit}
        submitLabel={template ? "Save Changes" : "Create Email Template"}
        loading={save.isPending || loadingTemplate}
        isDirty={form.isDirty()}
        size={720}
      >
        {loadingTemplate ? (
          <FormSkeleton />
        ) : (
          <>
            <FormSection title="Template details">
              <TextInput
                label="Template Name"
                placeholder="e.g. Offer Email — UG"
                withAsterisk
                maxLength={150}
                data-autofocus
                {...form.getInputProps("name")}
              />
              <OptionCards
                label="Email Type"
                required
                cols={3}
                data={emailTypeOptions}
                value={form.values.emailType}
                onChange={(value) => setEmailType(value as TEmailType)}
                error={form.errors.emailType}
              />
            </FormSection>

            <FormSection
              title="Content"
              action={
                <Group gap="xs" wrap="nowrap">
                  <SearchableSelect
                    placeholder={variables.isLoading ? "Loading..." : "Insert variable"}
                    searchPlaceholder="Search variables..."
                    leftSection={<IconBraces size={16} />}
                    data={toVariableOptions(variables.data)}
                    value={null}
                    onChange={insertVariable}
                    nothingFoundMessage="No variable found"
                    w={220}
                    aria-label="Insert variable at the cursor"
                  />
                  <Button variant="secondary" leftSection={<IconEye size={16} />} onClick={preview.open}>
                    Preview
                  </Button>
                </Group>
              }
            >
              <TextInput
                label="Subject"
                placeholder="e.g. Conditional Offer of Admission — {{program_name}}"
                maxLength={255}
                {...variableFieldProps("subject")}
              />
              <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <TextInput
                  label="Cc"
                  placeholder="e.g. admissions@university.edu"
                  description="Separate addresses with commas or semicolons, up to 20"
                  {...form.getInputProps("cc")}
                />
                <TextInput
                  label="Bcc"
                  placeholder="e.g. registrar@university.edu"
                  description="Separate addresses with commas or semicolons, up to 20"
                  {...form.getInputProps("bcc")}
                />
              </SimpleGrid>
              <Textarea
                label="Body"
                placeholder="Dear {{student_full_name}}, ..."
                withAsterisk
                autosize
                minRows={10}
                maxRows={24}
                maxLength={200000}
                {...variableFieldProps("body")}
              />
            </FormSection>

            <FormSection title="Attachment & status">
              <Switch
                label="Attach PDF Letter"
                description={
                  letterAvailable
                    ? "Sends the program's letter of this type as a PDF with the email."
                    : "Only Conditional Offer, Rejection and Manual Review emails have a letter to attach."
                }
                disabled={!letterAvailable}
                checked={letterAvailable && form.values.attachPdfLetter}
                onChange={(event) => form.setFieldValue("attachPdfLetter", event.currentTarget.checked)}
                error={form.errors.attachPdfLetter}
              />
              <OptionCards
                label="Status"
                data={statusOptions}
                value={form.values.status}
                onChange={(value) => form.setFieldValue("status", value as TEmailStatus)}
                error={form.errors.status}
              />
            </FormSection>
          </>
        )}
      </FormDrawer>

      {/* Shows the form as it is now, before saving. */}
      <EmailPreview
        opened={previewOpened}
        onClose={preview.close}
        content={{ ...form.values, attachPdfLetter: letterAvailable && form.values.attachPdfLetter }}
        variables={variables.data ?? []}
      />
    </>
  );
}
