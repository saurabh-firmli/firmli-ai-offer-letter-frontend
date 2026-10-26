import { Checkbox, Select, SimpleGrid, TextInput, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconCalendar } from "@tabler/icons-react";
import dayjs from "dayjs";
import FormDrawer from "../components/FormDrawer";
import FormSection from "../components/FormSection";
import OptionCards from "../components/OptionCards";
import { applyFormError, useResetOnOpen } from "../lib/forms";
import {
  ICriterion,
  IEligibilityOptions,
  TCriterionInput,
  TDataType,
  TOperator,
  useSaveCriterion,
} from "../lib/eligibility";
import RequiredValueInput from "./RequiredValueInput";
import { toApiDate } from "../lib/utils";

type TFormValues = {
  name: string;
  categoryId: string | null;
  description: string;
  dataType: TDataType;
  operator: TOperator | null;
  requiredValue: string;
  unit: string;
  documentTypeIds: string[];
  evidenceInstructions: string;
  rejectionReason: string;
  isMandatory: "true" | "false"; // OptionCards values are strings
  effectiveDate: Date | null;
  expiryDate: Date | null;
};

const toDate = (value: string | null | undefined) => (value ? dayjs(value).toDate() : null);

const toFormValues = (criterion: ICriterion | null): TFormValues => ({
  name: criterion?.name ?? "",
  categoryId: criterion ? String(criterion.categoryId) : null,
  description: criterion?.description ?? "",
  dataType: criterion?.dataType ?? "number", // most rules are scores (GPA, IELTS...)
  operator: criterion?.operator ?? null,
  requiredValue: criterion?.requiredValue ?? "",
  unit: criterion?.unit ?? "",
  documentTypeIds: (criterion?.documentTypeIds ?? []).map(String),
  evidenceInstructions: criterion?.evidenceInstructions ?? "",
  rejectionReason: criterion?.rejectionReason ?? "",
  isMandatory: criterion?.isMandatory === false ? "false" : "true",
  effectiveDate: toDate(criterion?.effectiveDate),
  expiryDate: toDate(criterion?.expiryDate),
});

const toBody = (values: TFormValues): TCriterionInput => ({
  ...values,
  categoryId: Number(values.categoryId), // required, checked by the form
  operator: values.operator ?? undefined, // required, checked by the form
  documentTypeIds: values.documentTypeIds.map(Number),
  isMandatory: values.isMandatory === "true",
  effectiveDate: toApiDate(values.effectiveDate),
  expiryDate: toApiDate(values.expiryDate),
});

interface ICriterionFormProps {
  opened: boolean;
  versionId: number;
  criterion: ICriterion | null; // null = add a new one
  options: IEligibilityOptions | undefined;
  onClose: () => void;
}

export default function CriterionForm({
  opened,
  versionId,
  criterion,
  options,
  onClose,
}: ICriterionFormProps) {
  const save = useSaveCriterion();
  const form = useForm<TFormValues>({
    initialValues: toFormValues(null),
    validate: {
      name: (value) => (value.trim() ? null : "Criterion name is required"),
      categoryId: (value) => (value ? null : "Select a category"),
      operator: (value) => (value ? null : "Select an operator"),
      // "min,max" needs both sides.
      requiredValue: (value, values) =>
        !value.replace(/,/g, "").trim()
          ? "Required value is required"
          : values.operator === "between" && value.split(",").some((part) => !part.trim())
            ? "Enter both values"
            : null,
      expiryDate: (value, values) =>
        value && values.effectiveDate && dayjs(value).isBefore(values.effectiveDate, "day")
          ? "Expiry date must be on or after the effective date"
          : null,
    },
  });

  useResetOnOpen(form, opened, criterion, toFormValues(criterion));

  const operatorOptions = (options?.operatorsByDataType[form.values.dataType] ?? []).map((value) => ({
    value,
    label: options?.operators.find((operator) => operator.value === value)?.label ?? value,
  }));

  // The value's format depends on both, so a change starts the value over.
  const setDataType = (dataType: TDataType) =>
    form.setValues({ dataType, operator: dataType === "boolean" ? "equal_to" : null, requiredValue: "" });
  const setOperator = (operator: TOperator | null) => form.setValues({ operator, requiredValue: "" });

  const handleSubmit = form.onSubmit((values) =>
    save.mutate(
      { id: criterion?.id, versionId, ...toBody(values) },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: criterion ? "Criterion updated" : "Criterion created",
            message: saved.name,
          });
          onClose();
        },
        // 422 under its field; a 409 (the version is no longer a draft) in a toast.
        onError: (error) => applyFormError(form, error, { toastTitle: "Could not save criterion" }),
      }
    )
  );

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      title={criterion ? "Edit Criterion" : "New Criterion"}
      description={
        criterion
          ? `${criterion.name} · ${criterion.category}`
          : "One admission rule an application is checked against."
      }
      onSubmit={handleSubmit}
      submitLabel={criterion ? "Save Changes" : "Create Criterion"}
      loading={save.isPending}
      isDirty={form.isDirty()}
      size={680}
    >
      <FormSection title="Criterion">
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <TextInput
            label="Criterion Name"
            placeholder="e.g. Minimum GPA"
            withAsterisk
            maxLength={150}
            data-autofocus
            {...form.getInputProps("name")}
          />
          <Select
            label="Category"
            placeholder={options ? "Select category" : "Loading..."}
            withAsterisk
            data={(options?.categories ?? []).map(({ id, label }) => ({ value: String(id), label }))}
            {...form.getInputProps("categoryId")}
          />
        </SimpleGrid>
        <Textarea
          label="Description"
          placeholder="e.g. Minimum GPA of 3.0 out of 4.0"
          autosize
          minRows={2}
          maxRows={6}
          maxLength={5000}
          {...form.getInputProps("description")}
        />
      </FormSection>

      <FormSection title="Rule">
        <OptionCards
          label="Data Type"
          required
          data={options?.dataTypes ?? []}
          value={form.values.dataType}
          onChange={(value) => setDataType(value as TDataType)}
          error={form.errors.dataType}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <Select
            label="Operator"
            placeholder="Select operator"
            withAsterisk
            data={operatorOptions}
            {...form.getInputProps("operator")}
            onChange={(value) => setOperator(value as TOperator | null)}
          />
          <TextInput
            label="Unit"
            placeholder="e.g. GPA, IELTS band"
            maxLength={50}
            {...form.getInputProps("unit")}
          />
        </SimpleGrid>
        <RequiredValueInput
          dataType={form.values.dataType}
          operator={form.values.operator}
          value={form.values.requiredValue}
          onChange={(value) => form.setFieldValue("requiredValue", value)}
          error={form.errors.requiredValue}
        />
      </FormSection>

      <FormSection title="Evidence">
        <Checkbox.Group
          label="Documents to Check"
          description="Which documents the AI should look at for this rule."
          {...form.getInputProps("documentTypeIds")}
        >
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" mt="xs">
            {(options?.documentTypes ?? []).map(({ id, label }) => (
              <Checkbox key={id} value={String(id)} label={label} />
            ))}
          </SimpleGrid>
        </Checkbox.Group>
        <Textarea
          label="Evidence Instructions"
          placeholder="e.g. Check the GPA on the final transcript"
          autosize
          minRows={2}
          maxRows={6}
          maxLength={5000}
          {...form.getInputProps("evidenceInstructions")}
        />
        <TextInput
          label="Rejection Reason"
          placeholder="e.g. GPA below 3.0"
          maxLength={255}
          {...form.getInputProps("rejectionReason")}
        />
      </FormSection>

      <FormSection title="Validity">
        <OptionCards
          label="Requirement"
          data={[
            { value: "true", label: "Mandatory" },
            { value: "false", label: "Optional" },
          ]}
          value={form.values.isMandatory}
          onChange={(value) => form.setFieldValue("isMandatory", value as "true" | "false")}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <DatePickerInput
            label="Effective Date"
            placeholder="Select date"
            valueFormat="DD MMM YYYY"
            leftSection={<IconCalendar size={16} />}
            clearable
            {...form.getInputProps("effectiveDate")}
          />
          <DatePickerInput
            label="Expiry Date"
            placeholder="Select date"
            valueFormat="DD MMM YYYY"
            leftSection={<IconCalendar size={16} />}
            clearable
            {...form.getInputProps("expiryDate")}
          />
        </SimpleGrid>
      </FormSection>
    </FormDrawer>
  );
}
