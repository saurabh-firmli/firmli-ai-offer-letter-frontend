import { useEffect, useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCalendar,
  IconLock,
  IconMail,
  IconPhone,
  IconSchool,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import RecordUnavailable from "../components/RecordUnavailable";
import SearchableSelect from "../components/SearchableSelect";
import { FormSkeleton } from "../components/Skeletons";
import OptionCards from "../components/OptionCards";
import {
  IApplication,
  IApplicationInput,
  TGender,
  useApplication,
  useApplicationOptions,
  useSaveApplication,
  useSubmitApplication,
} from "../lib/applications";
import errorHandler, { getFieldErrors } from "../lib/errors";
import { NO_AUTOFILL, applyFormError } from "../lib/forms";
import { useCountries } from "../lib/locations";
import { TStudyMode, studyModeLabels, useProgram } from "../lib/programs";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import { PHONE_ERROR, PHONE_HINT, formatDate, isEmail, isPhone, toApiDate } from "../lib/utils";
import { RO_APPLICATIONS, RO_ELIGIBILITY_CRITERIA, applicationPath, editApplicationPath } from "../routes";
import { Field } from "../components/Field";
import ApplicationDocuments from "./ApplicationDocuments";
import { studyModeOptions } from "./ProgramForm";

type TFormValues = {
  student: {
    firstName: string;
    middleName: string;
    lastName: string;
    dateOfBirth: Date | null;
    gender: string | null;
    nationalityId: string | null;
    residenceCountryId: string | null;
    passportNumber: string;
    email: string;
    phone: string;
    address: string;
  };
  programId: string | null;
  intake: string | null; // "fall-2026"
  studyMode: TStudyMode;
  applicationDate: Date | null;
};

const STEPS = ["Student", "Program", "Documents", "Review & Submit"];

const emptyValues: TFormValues = {
  student: {
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: null,
    gender: null,
    nationalityId: null,
    residenceCountryId: null,
    passportNumber: "",
    email: "",
    phone: "",
    address: "",
  },
  programId: null,
  intake: null,
  studyMode: "full_time",
  applicationDate: null, // today, set when the wizard opens
};

const toFormValues = (application: IApplication): TFormValues => ({
  student: {
    firstName: application.student.firstName,
    middleName: application.student.middleName ?? "",
    lastName: application.student.lastName,
    dateOfBirth: application.student.dateOfBirth ? dayjs(application.student.dateOfBirth).toDate() : null,
    gender: application.student.gender,
    nationalityId: application.student.nationality ? String(application.student.nationality.id) : null,
    residenceCountryId: application.student.residenceCountry
      ? String(application.student.residenceCountry.id)
      : null,
    passportNumber: application.student.passportNumber ?? "",
    email: application.student.email,
    phone: application.student.phone ?? "",
    address: application.student.address ?? "",
  },
  programId: String(application.program.id),
  intake: `${application.intakeTerm}-${application.intakeYear}`,
  studyMode: application.studyMode,
  applicationDate: dayjs(application.applicationDate).toDate(),
});

const toBody = ({
  student,
  programId,
  intake,
  studyMode,
  applicationDate,
}: TFormValues): IApplicationInput => {
  const [intakeTerm, intakeYear] = (intake ?? "-").split("-");
  return {
    student: {
      ...student,
      firstName: student.firstName.trim(),
      lastName: student.lastName.trim(),
      email: student.email.trim(),
      dateOfBirth: toApiDate(student.dateOfBirth),
      gender: student.gender as TGender | null,
      nationalityId: student.nationalityId ? Number(student.nationalityId) : null,
      residenceCountryId: student.residenceCountryId ? Number(student.residenceCountryId) : null,
    },
    programId: Number(programId),
    intakeTerm,
    intakeYear: Number(intakeYear),
    studyMode,
    applicationDate: toApiDate(applicationDate) ?? undefined,
  };
};

// Each step checks only its own fields before moving on.
const studentErrors = ({ student }: TFormValues) => ({
  ...(student.firstName.trim() ? {} : { "student.firstName": "First name is required" }),
  ...(student.lastName.trim() ? {} : { "student.lastName": "Last name is required" }),
  ...(isEmail(student.email) ? {} : { "student.email": "Enter a valid email" }),
  ...(!student.phone.trim() || isPhone(student.phone) ? {} : { "student.phone": PHONE_ERROR }),
});

const programErrors = (values: TFormValues) => ({
  ...(values.programId ? {} : { programId: "Select a program" }),
  ...(values.intake ? {} : { intake: "Select an intake" }),
});

/**
 * The New Application wizard. Steps 1 and 2 stay in the form; Next on step 2 creates the draft (or
 * saves it when going back), and the URL becomes /applications/:id/edit, so a draft can be picked up
 * again. Step 3 uploads documents to the draft; step 4 submits it, which locks it.
 */
export default function NewApplication() {
  const navigate = useNavigate();
  const params = useParams();
  const routeId = params.id ? Number(params.id) : null;
  const [applicationId, setApplicationId] = useState<number | null>(routeId);
  const [active, setActive] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [filled, setFilled] = useState(!routeId);

  const options = useApplicationOptions();
  const countries = useCountries();
  const programs = useDropdown("programs", { status: "active" });
  const application = useApplication(applicationId);
  const save = useSaveApplication();
  const submit = useSubmitApplication();

  // Today as of opening the wizard, not as of loading the app (a tab may stay open for days).
  const form = useForm<TFormValues>({ initialValues: { ...emptyValues, applicationDate: new Date() } });

  // An existing draft: fill the form once, then start at its documents.
  useEffect(() => {
    if (filled || !application.data) return;
    form.setValues(toFormValues(application.data));
    form.resetDirty();
    setFilled(true);
    setActive(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application.data, filled]);

  const picked = useProgram(form.values.programId ? Number(form.values.programId) : null);
  const program = picked.data?.id === Number(form.values.programId) ? picked.data : undefined;
  const criteriaVersion = program?.eligibilitySet?.publishedVersion ?? null;
  // A program picked here brings its own study mode as the default (an opened draft keeps its own).
  const [pickedByHand, setPickedByHand] = useState(false);
  useEffect(() => {
    if (pickedByHand && program) form.setFieldValue("studyMode", program.studyMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id, pickedByHand]);
  const countryOptions = (countries.data ?? []).map(({ id, name }) => ({ value: String(id), label: name }));
  const intakeOptions = (options.data?.intakes ?? []).map(({ term, year, label }) => ({
    value: `${term}-${year}`,
    label,
  }));
  const genderLabel = options.data?.genders.find(({ value }) => value === form.values.student.gender)?.label;

  const pickProgram = (value: string | null) => {
    form.setFieldValue("programId", value);
    setPickedByHand(true);
  };

  const goTo = (step: number) => setActive(Math.max(0, Math.min(step, STEPS.length - 1)));

  const next = () => {
    if (active === 0) {
      const errors = studentErrors(form.values);
      form.setErrors(errors);
      if (!Object.keys(errors).length) goTo(1);
      return;
    }
    if (active === 1) {
      const errors = programErrors(form.values);
      form.setErrors(errors);
      if (Object.keys(errors).length) return;
      save.mutate(
        { id: applicationId ?? undefined, ...toBody(form.values) },
        {
          onSuccess: (saved) => {
            if (!applicationId) {
              notifications.show({ color: "green", title: "Draft saved", message: saved.applicationNumber });
              navigate(editApplicationPath(saved.id), { replace: true });
            }
            setApplicationId(saved.id);
            form.resetDirty();
            goTo(2);
          },
          onError: (error) => {
            applyFormError(form, error, { toastTitle: "Could not save the application" });
            // A student field the API refused: show it on its step. (form.errors only updates on the
            // next render, so read the API's fields.)
            if (Object.keys(getFieldErrors(error)).some((key) => key.startsWith("student."))) goTo(0);
          },
        }
      );
      return;
    }
    goTo(active + 1);
  };

  const handleSubmit = () =>
    applicationId &&
    submit.mutate(applicationId, {
      onSuccess: (submitted) => {
        notifications.show({
          color: "green",
          title: "Application submitted",
          message: submitted.applicationNumber,
        });
        navigate(applicationPath(submitted.id), { replace: true });
      },
      onError: (error) => errorHandler(error, "Could not submit"),
    });

  // A submitted application can't be edited: show it instead.
  if (application.data && application.data.status !== "draft") {
    return <Navigate to={applicationPath(application.data.id)} replace />;
  }

  const loading = Boolean(routeId) && !filled;
  // A draft that can't be loaded (deleted, no access, offline) says so instead of loading forever.
  if (loading && application.error) {
    return (
      <Page>
        <PageHeader parent={{ label: "Applications", to: RO_APPLICATIONS }} title="Draft" />
        <RecordUnavailable
          error={application.error}
          noun="application"
          list={{ label: "Applications", to: RO_APPLICATIONS }}
        />
      </Page>
    );
  }
  const draft = application.data;
  const missing = draft?.missingDocuments ?? [];

  return (
    <Page>
      <PageHeader
        parent={{ label: "Applications", to: RO_APPLICATIONS }}
        title={draft ? `Draft ${draft.applicationNumber}` : "New Application"}
        description={
          draft
            ? `${draft.student.fullName} · ${draft.program.name} · ${draft.intake}`
            : "Add a student's application in four steps. It stays a draft until you submit it."
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding="xl">
        {loading ? (
          <FormSkeleton fields={6} />
        ) : (
          <Stack gap="xl">
            {/* Earlier steps can be revisited; later ones only through Next. */}
            <Stepper active={active} onStepClick={(step) => step < active && goTo(step)} size="sm">
              {STEPS.map((label) => (
                <Stepper.Step key={label} label={label} />
              ))}
            </Stepper>

            {active === 0 && (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <TextInput
                    label="First Name"
                    placeholder="e.g. Aisha"
                    withAsterisk
                    maxLength={100}
                    data-autofocus
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.firstName")}
                  />
                  <TextInput
                    label="Middle Name"
                    placeholder="Optional"
                    maxLength={100}
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.middleName")}
                  />
                  <TextInput
                    label="Last Name"
                    placeholder="e.g. Mohammed"
                    withAsterisk
                    maxLength={100}
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.lastName")}
                  />
                </SimpleGrid>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Email"
                    type="email"
                    placeholder="e.g. aisha@email.com"
                    description="A student who applies again is matched by email"
                    withAsterisk
                    leftSection={<IconMail size={16} />}
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.email")}
                  />
                  <TextInput
                    label="Phone"
                    placeholder="e.g. +234 801 234 5678"
                    description={PHONE_HINT}
                    maxLength={30}
                    leftSection={<IconPhone size={16} />}
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.phone")}
                  />
                  <DatePickerInput
                    label="Date of Birth"
                    placeholder="Select date"
                    valueFormat="DD MMM YYYY"
                    leftSection={<IconCalendar size={16} />}
                    maxDate={new Date()}
                    clearable
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.dateOfBirth")}
                  />
                  <Select
                    label="Gender"
                    placeholder="Select gender"
                    data={options.data?.genders ?? []}
                    clearable
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.gender")}
                  />
                  <SearchableSelect
                    label="Nationality"
                    placeholder={countries.isLoading ? "Loading..." : "Select country"}
                    searchPlaceholder="Search countries..."
                    nothingFoundMessage="No country found"
                    data={countryOptions}
                    value={form.values.student.nationalityId}
                    onChange={(value) => form.setFieldValue("student.nationalityId", value)}
                    error={form.errors["student.nationalityId"]}
                    clearable
                  />
                  <SearchableSelect
                    label="Country of Residence"
                    placeholder={countries.isLoading ? "Loading..." : "Select country"}
                    searchPlaceholder="Search countries..."
                    nothingFoundMessage="No country found"
                    data={countryOptions}
                    value={form.values.student.residenceCountryId}
                    onChange={(value) => form.setFieldValue("student.residenceCountryId", value)}
                    error={form.errors["student.residenceCountryId"]}
                    clearable
                  />
                  <TextInput
                    label="Passport Number"
                    placeholder="e.g. NG1234567"
                    maxLength={50}
                    {...NO_AUTOFILL}
                    {...form.getInputProps("student.passportNumber")}
                  />
                </SimpleGrid>
                <Textarea
                  label="Address"
                  placeholder="e.g. 12 Marina Road, Lagos"
                  autosize
                  minRows={2}
                  maxLength={500}
                  {...NO_AUTOFILL}
                  {...form.getInputProps("student.address")}
                />
              </Stack>
            )}

            {active === 1 && (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <SearchableSelect
                    label="Program"
                    description="Only active programs take applications"
                    withAsterisk
                    placeholder={programs.isLoading ? "Loading..." : "Select program"}
                    searchPlaceholder="Search programs..."
                    nothingFoundMessage="No active program found"
                    leftSection={<IconSchool size={16} />}
                    data={toSelectData(programs.data)}
                    value={form.values.programId}
                    onChange={pickProgram}
                    error={form.errors.programId}
                  />
                  <Select
                    label="Intake"
                    description="This year and the next two"
                    withAsterisk
                    placeholder="Select intake"
                    data={intakeOptions}
                    leftSection={<IconCalendar size={16} />}
                    {...form.getInputProps("intake")}
                  />
                </SimpleGrid>
                <OptionCards
                  label="Study Mode"
                  data={studyModeOptions}
                  value={form.values.studyMode}
                  onChange={(value) => form.setFieldValue("studyMode", value as TStudyMode)}
                  description="The program's own mode is picked for you"
                  error={form.errors.studyMode}
                />
                <DatePickerInput
                  label="Application Date"
                  placeholder="Today"
                  valueFormat="DD MMM YYYY"
                  leftSection={<IconCalendar size={16} />}
                  maxDate={new Date()}
                  w={{ base: "100%", sm: 260 }}
                  {...form.getInputProps("applicationDate")}
                />

                {/* The criteria the application is checked against, from the program's eligibility set. */}
                {program &&
                  (criteriaVersion ? (
                    <Alert
                      variant="light"
                      color="primary"
                      icon={<IconLock size={18} />}
                      title="Criteria Version Locked"
                    >
                      Checked against <b>{program.eligibilitySet?.name}</b> v{criteriaVersion}. The version
                      locks when you submit, so later rule changes don't affect this application.
                    </Alert>
                  ) : (
                    <Alert
                      variant="light"
                      color="orange"
                      icon={<IconAlertTriangle size={18} />}
                      title="No published criteria"
                    >
                      {program.name} has no published eligibility criteria, so this application can be saved
                      but not submitted.{" "}
                      <Anchor component={Link} to={RO_ELIGIBILITY_CRITERIA} size="sm">
                        Publish them in Eligibility Criteria
                      </Anchor>
                    </Alert>
                  ))}
              </Stack>
            )}

            {active === 2 &&
              (draft?.documentRequirements ? (
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    Upload what the program asks for. Missing documents don't stop you from submitting; they
                    stay listed as missing.
                  </Text>
                  <ApplicationDocuments application={draft} editable />
                </Stack>
              ) : (
                <FormSkeleton fields={2} />
              ))}

            {active === 3 && draft && (
              <Stack gap="lg">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={600}>Student</Text>
                      <Anchor component="button" size="sm" onClick={() => goTo(0)}>
                        Edit
                      </Anchor>
                    </Group>
                    <SimpleGrid cols={2} spacing="sm">
                      <Field label="Name">{draft.student.fullName}</Field>
                      <Field label="Email">{draft.student.email}</Field>
                      <Field label="Phone">{draft.student.phone}</Field>
                      <Field label="Date of Birth">{formatDate(draft.student.dateOfBirth)}</Field>
                      <Field label="Gender">{genderLabel}</Field>
                      <Field label="Passport">{draft.student.passportNumber}</Field>
                      <Field label="Nationality">{draft.student.nationality?.name}</Field>
                      <Field label="Residence">{draft.student.residenceCountry?.name}</Field>
                    </SimpleGrid>
                  </Stack>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={600}>Program</Text>
                      <Anchor component="button" size="sm" onClick={() => goTo(1)}>
                        Edit
                      </Anchor>
                    </Group>
                    <SimpleGrid cols={2} spacing="sm">
                      <Field label="Program">{draft.program.name}</Field>
                      <Field label="Intake">{draft.intake}</Field>
                      <Field label="Study Mode">{studyModeLabels[draft.studyMode]}</Field>
                      <Field label="Application Date">{formatDate(draft.applicationDate)}</Field>
                      <Field label="Criteria">
                        {draft.eligibilityVersion
                          ? `v${draft.eligibilityVersion.versionNumber}`
                          : "None published"}
                      </Field>
                      <Field label="Documents">{`${draft.documentCount} uploaded`}</Field>
                    </SimpleGrid>
                  </Stack>
                </SimpleGrid>

                {missing.length > 0 && (
                  <Alert
                    variant="light"
                    color="orange"
                    icon={<IconAlertTriangle size={18} />}
                    title="Missing documents"
                  >
                    {missing.join(", ")}. You can still submit; they stay listed as missing.
                  </Alert>
                )}
                {!draft.eligibilityVersion && (
                  <Alert
                    variant="light"
                    color="red"
                    icon={<IconAlertTriangle size={18} />}
                    title="Can't submit yet"
                  >
                    {draft.program.name} has no published eligibility criteria.{" "}
                    <Anchor component={Link} to={RO_ELIGIBILITY_CRITERIA} size="sm">
                      Publish them first
                    </Anchor>
                  </Alert>
                )}

                <Divider />
                <Checkbox
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.currentTarget.checked)}
                  label="I confirm that the information provided is accurate and the student has consented to processing"
                />
              </Stack>
            )}

            <Group justify="space-between" pt="md" style={{ borderTop: "1px solid var(--firmli-divider)" }}>
              {active === 0 ? (
                <Button variant="secondary" component={Link} to={RO_APPLICATIONS}>
                  Cancel
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => goTo(active - 1)}>
                  Back
                </Button>
              )}
              <Group gap="sm">
                {/* Once there is a draft, it can be left and picked up later from the list. */}
                {draft && active >= 2 && (
                  <Button variant="tertiary" component={Link} to={RO_APPLICATIONS}>
                    Save & Exit
                  </Button>
                )}
                {active < STEPS.length - 1 ? (
                  <Button onClick={next} loading={save.isPending}>
                    {active === 1 ? (draft ? "Save & Continue" : "Create Draft & Continue") : "Next"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    loading={submit.isPending}
                    disabled={!confirmed || !draft?.eligibilityVersion}
                  >
                    Submit Application
                  </Button>
                )}
              </Group>
            </Group>
          </Stack>
        )}
      </Card>
    </Page>
  );
}
