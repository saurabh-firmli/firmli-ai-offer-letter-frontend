import { ReactNode } from "react";
import { Button, Group, SimpleGrid, TextInput, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconBraces, IconCircleCheck, IconCircleX, IconClipboardCheck, IconEye } from "@tabler/icons-react";
import { isAxiosError } from "axios";
import FormDrawer from "../components/FormDrawer";
import FormSection from "../components/FormSection";
import { FormSkeleton } from "../components/Skeletons";
import SearchableSelect from "../components/SearchableSelect";
import OptionCards, { IOptionCard } from "../components/OptionCards";
import StatusDot from "../components/StatusDot";
import { getErrorMessage } from "../lib/errors";
import { applyFormError, useResetOnOpen } from "../lib/forms";
import { useVariableInsertion } from "../lib/useVariableInsertion";
import {
  ILetterTemplate,
  ILetterTemplateSummary,
  TLetterTemplateInput,
  TLetterType,
  TTemplateStatus,
  letterTypeLabels,
  templateStatusColors,
  templateStatusLabels,
  toVariableOptions,
  useLetterTemplate,
  useSaveLetterTemplate,
  useTemplateVariables,
} from "../lib/letterTemplates";
import { toOptions } from "../lib/utils";
import LetterPreview from "./LetterPreview";

type TFormValues = {
  name: string;
  letterType: TLetterType;
  subject: string;
  referencePrefix: string;
  body: string;
  signatoryName: string;
  signatoryTitle: string;
  headerHtml: string;
  footerHtml: string;
  status: TTemplateStatus;
};

// The API returns unset fields as null; text inputs want "" (which the API also accepts).
const toFormValues = (template: ILetterTemplate | null | undefined): TFormValues => ({
  name: template?.name ?? "",
  letterType: template?.letterType ?? "conditional_offer", // the most common letter
  subject: template?.subject ?? "",
  referencePrefix: template?.referencePrefix ?? "",
  body: template?.body ?? "",
  signatoryName: template?.signatoryName ?? "",
  signatoryTitle: template?.signatoryTitle ?? "",
  headerHtml: template?.headerHtml ?? "",
  footerHtml: template?.footerHtml ?? "",
  status: template?.status ?? "draft",
});

const toBody = ({ referencePrefix, ...values }: TFormValues): TLetterTemplateInput => ({
  ...values,
  // Empty = keep the current prefix (or the API default "LTR" on create).
  referencePrefix: referencePrefix.trim() || undefined,
});

const letterTypeIcons: Record<TLetterType, ReactNode> = {
  conditional_offer: <IconCircleCheck size={16} />,
  rejection: <IconCircleX size={16} />,
  manual_review: <IconClipboardCheck size={16} />,
};

const letterTypeOptions: IOptionCard[] = toOptions(letterTypeLabels).map((option) => ({
  ...option,
  icon: letterTypeIcons[option.value as TLetterType],
}));

const statusOptions: IOptionCard[] = toOptions(templateStatusLabels).map((option) => ({
  ...option,
  icon: <StatusDot color={templateStatusColors[option.value as TTemplateStatus]} />,
}));

interface ILetterTemplateFormProps {
  opened: boolean;
  template: ILetterTemplateSummary | null; // null = create a new one
  onClose: () => void;
}

export default function LetterTemplateForm({ opened, template, onClose }: ILetterTemplateFormProps) {
  const save = useSaveLetterTemplate();
  // The list has no body / header / footer, so an edit loads the full template first.
  const detail = useLetterTemplate(opened && template ? template.id : null);
  const variables = useTemplateVariables(opened);
  const [previewOpened, preview] = useDisclosure();
  const loadingTemplate = Boolean(template) && detail.isLoading;

  const form = useForm<TFormValues>({
    initialValues: toFormValues(null),
    validate: {
      name: (value) => (value.trim() ? null : "Template name is required"),
      body: (value) => (value.trim() ? null : "Body is required"),
      referencePrefix: (value) =>
        !value || /^[A-Z0-9-]{1,10}$/.test(value) ? null : "Use up to 10 letters, numbers or -",
    },
  });

  // New: a blank form. Edit: refills once the full template has loaded.
  useResetOnOpen(form, opened, template ? detail.data : "new", toFormValues(template ? detail.data : null));

  // "Insert variable" writes into the subject, body, header or footer, wherever the cursor was.
  const { fieldProps: variableFieldProps, insert: insertVariable } = useVariableInsertion<
    TFormValues,
    "subject" | "body" | "headerHtml" | "footerHtml"
  >(form, "body", ["subject"]);

  const handleSubmit = form.onSubmit((values) =>
    save.mutate(
      { id: template?.id, ...toBody(values) },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: template ? "Letter template updated" : "Letter template created",
            message: saved.name,
          });
          onClose();
        },
        onError: (error) => {
          // 409 is either a duplicate name or a type change on a template that programs use.
          if (isAxiosError(error) && error.response?.status === 409 && /type/i.test(getErrorMessage(error))) {
            form.setFieldError("letterType", getErrorMessage(error));
            return;
          }
          // 422 unknown {{variables}} come back under subject / body / headerHtml / footerHtml.
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
        title={template ? "Edit Letter Template" : "New Letter Template"}
        description={
          template
            ? `${template.name} · ${letterTypeLabels[template.letterType]}`
            : "Write the letter once; {{variables}} are filled in for each student."
        }
        onSubmit={handleSubmit}
        submitLabel={template ? "Save Changes" : "Create Letter Template"}
        loading={save.isPending || loadingTemplate}
        isDirty={form.isDirty()}
        size={720}
      >
        {loadingTemplate ? (
          <FormSkeleton />
        ) : (
          <>
            <FormSection title="Template details">
              <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <TextInput
                  label="Template Name"
                  placeholder="e.g. Conditional Offer — UG"
                  withAsterisk
                  maxLength={150}
                  data-autofocus
                  {...form.getInputProps("name")}
                />
                <TextInput
                  label="Reference Prefix"
                  placeholder="LTR"
                  maxLength={10}
                  {...form.getInputProps("referencePrefix")}
                  onChange={(e) => form.setFieldValue("referencePrefix", e.currentTarget.value.toUpperCase())}
                />
              </SimpleGrid>
              <OptionCards
                label="Letter Type"
                required
                data={letterTypeOptions}
                value={form.values.letterType}
                onChange={(value) => form.setFieldValue("letterType", value as TLetterType)}
                error={form.errors.letterType}
              />
              <TextInput
                label="Subject"
                placeholder="e.g. Conditional Offer of Admission — {{program_name}}"
                maxLength={255}
                {...variableFieldProps("subject")}
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
              <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <Textarea
                  label="Header HTML"
                  placeholder="Shown at the top of every page"
                  autosize
                  minRows={3}
                  maxRows={10}
                  maxLength={20000}
                  ff="monospace"
                  fz="xs"
                  {...variableFieldProps("headerHtml")}
                />
                <Textarea
                  label="Footer HTML"
                  placeholder="Shown at the bottom of every page"
                  autosize
                  minRows={3}
                  maxRows={10}
                  maxLength={20000}
                  ff="monospace"
                  fz="xs"
                  {...variableFieldProps("footerHtml")}
                />
              </SimpleGrid>
            </FormSection>

            <FormSection title="Signature & status">
              <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <TextInput
                  label="Authorized Signatory"
                  placeholder="e.g. Admissions Office"
                  maxLength={150}
                  {...form.getInputProps("signatoryName")}
                />
                <TextInput
                  label="Signatory Title"
                  placeholder="e.g. Director of Admissions"
                  maxLength={150}
                  {...form.getInputProps("signatoryTitle")}
                />
              </SimpleGrid>
              <OptionCards
                label="Status"
                data={statusOptions}
                value={form.values.status}
                onChange={(value) => form.setFieldValue("status", value as TTemplateStatus)}
                error={form.errors.status}
              />
            </FormSection>
          </>
        )}
      </FormDrawer>

      {/* Shows the form as it is now, before saving. */}
      <LetterPreview
        opened={previewOpened}
        onClose={preview.close}
        content={form.values}
        variables={variables.data ?? []}
      />
    </>
  );
}
