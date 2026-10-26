import { ComponentProps, ReactNode } from "react";
import { Anchor, Autocomplete, Combobox, Group, Input, SimpleGrid, TextInput, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowsShuffle,
  IconBriefcase,
  IconCalendar,
  IconClock,
  IconFileCertificate,
  IconMail,
  IconListCheck,
  IconMapPin,
  IconWorld,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import FormDrawer from "../components/FormDrawer";
import FormSection from "../components/FormSection";
import SearchableSelect from "../components/SearchableSelect";
import OptionCards, { IOptionCard } from "../components/OptionCards";
import StatusDot from "../components/StatusDot";
import { useCan } from "../lib/auth";
import { IDropdownOption, toSelectData, useDropdown } from "../lib/dropdowns";
import { TEmailType } from "../lib/emailTemplates";
import { applyFormError, useResetOnOpen } from "../lib/forms";
import { TLetterType } from "../lib/letterTemplates";
import {
  IProgram,
  TProgramInput,
  TProgramStatus,
  TStudyMode,
  programStatusColors,
  programStatusLabels,
  studyModeLabels,
  useSaveProgram,
} from "../lib/programs";
import { toApiDate, toOptions } from "../lib/utils";
import CampusForm from "./CampusForm";

// Suggestions only; any text is allowed.
const awardLevels = ["Certificate", "Diploma", "Bachelors", "Masters", "PhD"];
const durations = ["6 months", "1 year", "18 months", "2 years", "3 years", "4 years"];

type TFormValues = {
  name: string;
  code: string;
  awardLevel: string;
  campusId: string | null; // Select values are strings
  duration: string;
  studyMode: TStudyMode;
  applicationDeadline: Date | null;
  status: TProgramStatus;
  description: string;
  conditionalOfferTemplateId: string | null;
  rejectionTemplateId: string | null;
  manualReviewTemplateId: string | null;
  offerEmailTemplateId: string | null;
  rejectionEmailTemplateId: string | null;
  eligibilitySetId: string | null;
};

const toId = (value: number | null | undefined) => (value ? String(value) : null);

// The API returns unset fields as null; text inputs want "" (which the API also accepts).
const toFormValues = (program: IProgram | null): TFormValues => ({
  name: program?.name ?? "",
  code: program?.code ?? "",
  awardLevel: program?.awardLevel ?? "",
  campusId: toId(program?.campusId),
  duration: program?.duration ?? "",
  studyMode: program?.studyMode ?? "full_time",
  applicationDeadline: program?.applicationDeadline ? dayjs(program.applicationDeadline).toDate() : null,
  status: program?.status ?? "draft",
  description: program?.description ?? "",
  conditionalOfferTemplateId: toId(program?.conditionalOfferTemplateId),
  rejectionTemplateId: toId(program?.rejectionTemplateId),
  manualReviewTemplateId: toId(program?.manualReviewTemplateId),
  offerEmailTemplateId: toId(program?.offerEmailTemplateId),
  rejectionEmailTemplateId: toId(program?.rejectionEmailTemplateId),
  eligibilitySetId: toId(program?.eligibilitySetId),
});

const fromId = (value: string | null) => (value ? Number(value) : null);

const toBody = (values: TFormValues): TProgramInput => ({
  ...values,
  campusId: Number(values.campusId), // required, checked by the form
  duration: values.duration.trim(), // required, checked by the form
  applicationDeadline: toApiDate(values.applicationDeadline),
  conditionalOfferTemplateId: fromId(values.conditionalOfferTemplateId),
  rejectionTemplateId: fromId(values.rejectionTemplateId),
  manualReviewTemplateId: fromId(values.manualReviewTemplateId),
  offerEmailTemplateId: fromId(values.offerEmailTemplateId),
  rejectionEmailTemplateId: fromId(values.rejectionEmailTemplateId),
  eligibilitySetId: fromId(values.eligibilitySetId),
});

const studyModeIcons: Record<TStudyMode, ReactNode> = {
  full_time: <IconBriefcase size={16} />,
  part_time: <IconClock size={16} />,
  online: <IconWorld size={16} />,
  hybrid: <IconArrowsShuffle size={16} />,
};

// Also used by the New Application wizard, so study mode looks the same everywhere.
export const studyModeOptions: IOptionCard[] = toOptions(studyModeLabels).map((option) => ({
  ...option,
  icon: studyModeIcons[option.value as TStudyMode],
}));

// Each status keeps its color as a dot, matching the badge in the programs table.
const statusOptions: IOptionCard[] = toOptions(programStatusLabels).map((option) => ({
  ...option,
  icon: <StatusDot color={programStatusColors[option.value as TProgramStatus]} />,
}));

// One template dropdown per letter type; each lists only that type's templates.
const letterFields: { field: keyof TFormValues; letterType: TLetterType; label: string }[] = [
  { field: "conditionalOfferTemplateId", letterType: "conditional_offer", label: "Conditional Offer Letter" },
  { field: "rejectionTemplateId", letterType: "rejection", label: "Rejection Letter" },
  { field: "manualReviewTemplateId", letterType: "manual_review", label: "Manual Review Letter" },
];

// One template dropdown per email a program sends; each lists only that type's templates.
const emailFields: { field: keyof TFormValues; emailType: TEmailType; label: string }[] = [
  { field: "offerEmailTemplateId", emailType: "conditional_offer", label: "Offer Email" },
  { field: "rejectionEmailTemplateId", emailType: "rejection", label: "Rejection Email" },
];

type TSelectProps = Omit<ComponentProps<typeof SearchableSelect>, "data">;

/** A template dropdown: "None" when empty, drafts marked (a letter or email can't be made from one yet). */
function TemplateSelect({
  templates,
  drafts,
  loading,
  ...props
}: {
  templates: IDropdownOption[] | undefined;
  drafts: IDropdownOption[] | undefined;
  loading: boolean;
} & TSelectProps) {
  const draftIds = new Set((drafts ?? []).map(({ value }) => value));
  return (
    <SearchableSelect
      placeholder={loading ? "Loading..." : "None"}
      data={(templates ?? []).map(({ value, label }) => ({
        value: String(value),
        label: draftIds.has(value) ? `${label} (Draft)` : label,
      }))}
      nothingFoundMessage="No template of this type yet"
      clearable
      {...props}
    />
  );
}

function LetterTemplateSelect({
  letterType,
  enabled,
  ...props
}: { letterType: TLetterType; enabled: boolean } & TSelectProps) {
  const templates = useDropdown("letter-templates", { letterType }, enabled);
  // One call for every letter type's drafts, shared by the three selects.
  const drafts = useDropdown("letter-templates", { status: "draft" }, enabled);
  return (
    <TemplateSelect
      templates={templates.data}
      drafts={drafts.data}
      loading={templates.isLoading}
      leftSection={<IconFileCertificate size={16} />}
      {...props}
    />
  );
}

function EmailTemplateSelect({
  emailType,
  enabled,
  ...props
}: { emailType: TEmailType; enabled: boolean } & TSelectProps) {
  const templates = useDropdown("email-templates", { emailType }, enabled);
  const drafts = useDropdown("email-templates", { status: "draft" }, enabled);
  return (
    <TemplateSelect
      templates={templates.data}
      drafts={drafts.data}
      loading={templates.isLoading}
      leftSection={<IconMail size={16} />}
      {...props}
    />
  );
}

interface IProgramFormProps {
  opened: boolean;
  program: IProgram | null; // null = create a new one
  onClose: () => void;
}

export default function ProgramForm({ opened, program, onClose }: IProgramFormProps) {
  const save = useSaveProgram();
  const campuses = useDropdown("campuses", {}, opened);
  const [campusFormOpened, campusForm] = useDisclosure();
  const can = useCan();
  const eligibilitySets = useDropdown("eligibility-sets", {}, opened);
  const form = useForm<TFormValues>({
    initialValues: toFormValues(null),
    validate: {
      name: (value) => (value.trim() ? null : "Program name is required"),
      code: (value) => (value.trim() ? null : "Program code is required"),
      campusId: (value) => (value ? null : "Select a campus"),
      // Also asked for when editing an older program that has none yet.
      duration: (value) => (value.trim() ? null : "Duration is required"),
    },
  });

  useResetOnOpen(form, opened, program, toFormValues(program));

  const handleSubmit = form.onSubmit((values) =>
    save.mutate(
      { id: program?.id, ...toBody(values) },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: program ? "Program updated" : "Program created",
            message: `${saved.name} (${saved.code})`,
          });
          onClose();
        },
        // 409 = duplicate code, shown under the Program Code field. A template of the wrong type
        // comes back as a 422 under its dropdown.
        onError: (error) =>
          applyFormError(form, error, { conflictField: "code", toastTitle: "Could not save program" }),
      }
    )
  );

  return (
    <>
      <FormDrawer
        opened={opened}
        onClose={onClose}
        title={program ? "Edit Program" : "New Program"}
        description={
          program ? `${program.name} · ${program.code}` : "Fill in the details to create a new program."
        }
        onSubmit={handleSubmit}
        submitLabel={program ? "Save Changes" : "Create Program"}
        loading={save.isPending}
        isDirty={form.isDirty()}
      >
        <FormSection title="Program details">
          <TextInput
            label="Program Name"
            placeholder="e.g. MSc Data Science"
            withAsterisk
            maxLength={150}
            data-autofocus
            {...form.getInputProps("name")}
          />
          {/* Required fields first, optional ones after. */}
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <TextInput
              label="Program Code"
              placeholder="e.g. MSDS"
              withAsterisk
              maxLength={50}
              {...form.getInputProps("code")}
              onChange={(e) => form.setFieldValue("code", e.currentTarget.value.toUpperCase())}
            />
            {/* "+ Add new" sits on the label row (outside the <label>), so the grid rows stay even. */}
            <div>
              <Group justify="space-between" wrap="nowrap">
                <Input.Label required htmlFor="program-campus">
                  Campus
                </Input.Label>
                {can("campuses", "create") && (
                  <Anchor component="button" type="button" size="xs" onClick={campusForm.open}>
                    + Add new
                  </Anchor>
                )}
              </Group>
              <SearchableSelect
                id="program-campus"
                placeholder={campuses.isLoading ? "Loading..." : "Select campus"}
                leftSection={<IconMapPin size={16} />}
                data={toSelectData(campuses.data)}
                nothingFoundMessage="No campus found"
                {...form.getInputProps("campusId")}
              />
            </div>
            {/* Suggestions, but any text is allowed; the chevron shows it is a dropdown. */}
            <Autocomplete
              label="Duration"
              withAsterisk
              placeholder="Select duration"
              data={durations}
              maxLength={50}
              rightSection={<Combobox.Chevron />}
              rightSectionPointerEvents="none"
              {...form.getInputProps("duration")}
            />
            <Autocomplete
              label="Award Level"
              placeholder="Select award level"
              data={awardLevels}
              maxLength={100}
              rightSection={<Combobox.Chevron />}
              rightSectionPointerEvents="none"
              {...form.getInputProps("awardLevel")}
            />
          </SimpleGrid>
          <Textarea
            label="Description"
            placeholder="A short summary of the program"
            autosize
            minRows={3}
            maxRows={10}
            maxLength={5000}
            {...form.getInputProps("description")}
          />
        </FormSection>

        <FormSection title="Delivery & status">
          <OptionCards
            label="Study Mode"
            data={studyModeOptions}
            value={form.values.studyMode}
            onChange={(value) => form.setFieldValue("studyMode", value as TStudyMode)}
            error={form.errors.studyMode}
          />
          <DatePickerInput
            label="Application Deadline"
            placeholder="Select date"
            valueFormat="DD MMM YYYY"
            leftSection={<IconCalendar size={16} />}
            clearable
            {...form.getInputProps("applicationDeadline")}
          />
          <OptionCards
            label="Status"
            data={statusOptions}
            value={form.values.status}
            onChange={(value) => form.setFieldValue("status", value as TProgramStatus)}
            error={form.errors.status}
          />
        </FormSection>

        <FormSection title="Eligibility & letters">
          <SearchableSelect
            label="Eligibility Set"
            description="The admission rules this program checks; manage them under Eligibility Criteria."
            placeholder={eligibilitySets.isLoading ? "Loading..." : "None"}
            leftSection={<IconListCheck size={16} />}
            data={toSelectData(eligibilitySets.data)}
            nothingFoundMessage="No eligibility set yet"
            clearable
            {...form.getInputProps("eligibilitySetId")}
          />
          {letterFields.map(({ field, letterType, label }) => (
            <LetterTemplateSelect
              key={field}
              label={label}
              letterType={letterType}
              enabled={opened}
              {...form.getInputProps(field)}
            />
          ))}
        </FormSection>

        <FormSection title="Emails">
          {emailFields.map(({ field, emailType, label }) => (
            <EmailTemplateSelect
              key={field}
              label={label}
              emailType={emailType}
              enabled={opened}
              {...form.getInputProps(field)}
            />
          ))}
        </FormSection>
      </FormDrawer>

      {/* A campus added from here is selected right away. */}
      <CampusForm
        opened={campusFormOpened}
        campus={null}
        onClose={campusForm.close}
        onSaved={(campus) => form.setFieldValue("campusId", String(campus.id))}
      />
    </>
  );
}
