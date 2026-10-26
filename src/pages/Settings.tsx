import { ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Indicator,
  NumberInput,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangleFilled,
  IconArrowBackUp,
  IconAt,
  IconBuilding,
  IconCircleCheckFilled,
  IconCloud,
  IconCpu,
  IconKey,
  IconLock,
  IconPalette,
  IconMail,
  IconPhone,
  IconPlugConnected,
  IconRefresh,
  IconRobot,
  IconSend,
  IconServer,
  IconShieldCheck,
  IconUser,
  IconUserCheck,
  IconWorld,
} from "@tabler/icons-react";
import ErrorState from "../components/ErrorState";
import OptionCards from "../components/OptionCards";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import SearchableSelect from "../components/SearchableSelect";
import { FormSkeleton } from "../components/Skeletons";
import { formatModelPrice } from "../lib/aiUsage";
import { useCan } from "../lib/auth";
import errorHandler from "../lib/errors";
import { applyFormError, useResetOnOpen } from "../lib/forms";
import {
  ISettings,
  MAX_EMAIL_RETRIES,
  MAX_PROMPT_LENGTH,
  TSettingsInput,
  useSaveSettings,
  useSendTestEmail,
  useSettings,
  modelGroups,
  useSettingsOptions,
} from "../lib/settings";
import { PHONE_ERROR, PHONE_HINT, formatDateTime, isEmail, isPhone } from "../lib/utils";
import BrandingFields, { isBrandColor } from "./SettingsBranding";
import classes from "./Settings.module.css";

// Form values: text fields use "" for empty, thresholds are percentages, ids are strings for the dropdowns.
type TFormValues = {
  name: string;
  contactEmail: string;
  phone: string;
  address: string;
  website: string;
  brandColor: string; // "" = Firmli's navy
  autoAssessment: boolean;
  autoLetterGeneration: boolean;
  autoEmailDispatch: boolean;
  autoApproveOffers: boolean;
  autoApproveRejections: boolean;
  requireRejectionApproval: boolean;
  requireManualReviewEdgeCases: boolean;
  flagLowConfidence: boolean;
  flagMissingDocuments: boolean;
  offerConfidence: number; // 0 to 100
  rejectionConfidence: number;
  defaultReviewerId: string | null;
  emailMaxRetries: number;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number | string; // "" while empty
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string; // a new password typed in; empty keeps the saved one
  removeSmtpPassword: boolean;
  smtpFromEmail: string;
  smtpFromName: string;
  extractionModelId: string;
  extractionFallbackModelId: string;
  assessmentModelId: string;
  assessmentEscalationModelId: string;
  verifyDocumentType: boolean;
  extractionPrompt: string;
  assessmentPrompt: string;
  openaiApiKey: string; // a new key typed in; empty keeps the saved one
  removeApiKey: boolean;
};

type TSwitchField = {
  [K in keyof TFormValues]: TFormValues[K] extends boolean ? K : never;
}[keyof TFormValues];

// A field's hint under it instead of above, so fields side by side line up.
const HINT_BELOW: ("label" | "input" | "description" | "error")[] = [
  "label",
  "input",
  "description",
  "error",
];

const toPercent = (value: number) => Math.round(value * 100);

const toFormValues = (settings: ISettings | undefined): TFormValues => ({
  name: settings?.name ?? "",
  contactEmail: settings?.contactEmail ?? "",
  phone: settings?.phone ?? "",
  address: settings?.address ?? "",
  website: settings?.website ?? "",
  brandColor: settings?.brandColor ?? "",
  autoAssessment: settings?.autoAssessment ?? true,
  autoLetterGeneration: settings?.autoLetterGeneration ?? true,
  autoEmailDispatch: settings?.autoEmailDispatch ?? false,
  autoApproveOffers: settings?.autoApproveOffers ?? false,
  autoApproveRejections: settings?.autoApproveRejections ?? false,
  requireRejectionApproval: settings?.requireRejectionApproval ?? true,
  requireManualReviewEdgeCases: settings?.requireManualReviewEdgeCases ?? true,
  flagLowConfidence: settings?.flagLowConfidence ?? true,
  flagMissingDocuments: settings?.flagMissingDocuments ?? true,
  offerConfidence: toPercent(settings?.offerConfidenceThreshold ?? 0.85),
  rejectionConfidence: toPercent(settings?.rejectionConfidenceThreshold ?? 0.9),
  defaultReviewerId: settings?.defaultReviewerId ? String(settings.defaultReviewerId) : null,
  emailMaxRetries: settings?.emailMaxRetries ?? 3,
  smtpEnabled: settings?.smtpEnabled ?? false,
  smtpHost: settings?.smtpHost ?? "",
  smtpPort: settings?.smtpPort ?? "",
  smtpSecure: settings?.smtpSecure ?? false,
  smtpUser: settings?.smtpUser ?? "",
  smtpPassword: "",
  removeSmtpPassword: false,
  smtpFromEmail: settings?.smtpFromEmail ?? "",
  smtpFromName: settings?.smtpFromName ?? "",
  extractionModelId: String(settings?.extractionModelId ?? ""),
  extractionFallbackModelId: String(settings?.extractionFallbackModelId ?? ""),
  assessmentModelId: String(settings?.assessmentModelId ?? ""),
  assessmentEscalationModelId: String(settings?.assessmentEscalationModelId ?? ""),
  verifyDocumentType: settings?.verifyDocumentType ?? true,
  extractionPrompt: settings?.extractionPrompt ?? "",
  assessmentPrompt: settings?.assessmentPrompt ?? "",
  openaiApiKey: "",
  removeApiKey: false,
});

// The API takes the whole form; empty text means "not set", percentages go back to 0 to 1. The
// secrets (OpenAI key, SMTP password) go only when they change: a new one, or a removal; left out,
// the saved one stays.
const toBody = ({
  offerConfidence,
  rejectionConfidence,
  openaiApiKey,
  removeApiKey,
  smtpPassword,
  removeSmtpPassword,
  ...values
}: TFormValues): TSettingsInput => ({
  ...values,
  ...(removeSmtpPassword ? { smtpPassword: "" } : smtpPassword ? { smtpPassword } : {}),
  smtpHost: values.smtpHost.trim() || null,
  smtpPort: values.smtpPort === "" ? null : Number(values.smtpPort),
  smtpUser: values.smtpUser.trim() || null,
  smtpFromEmail: values.smtpFromEmail.trim() || null,
  smtpFromName: values.smtpFromName.trim() || null,
  ...(removeApiKey
    ? { openaiApiKey: null }
    : openaiApiKey.trim()
      ? { openaiApiKey: openaiApiKey.trim() }
      : {}),
  name: values.name.trim(),
  website: values.website.trim() || null,
  brandColor: values.brandColor.trim().toUpperCase() || null,
  offerConfidenceThreshold: offerConfidence / 100,
  rejectionConfidenceThreshold: rejectionConfidence / 100,
  defaultReviewerId: values.defaultReviewerId ? Number(values.defaultReviewerId) : null,
  extractionModelId: Number(values.extractionModelId),
  extractionFallbackModelId: Number(values.extractionFallbackModelId),
  assessmentModelId: Number(values.assessmentModelId),
  assessmentEscalationModelId: Number(values.assessmentEscalationModelId),
});

// The API's field names for the percentages, so its 422 messages land under the right input.
const percentFieldOf: Record<string, keyof TFormValues & string> = {
  offerConfidenceThreshold: "offerConfidence",
  rejectionConfidenceThreshold: "rejectionConfidence",
};

// The sections, in page order, for the tab bar at the top.
const SECTIONS = [
  { id: "institution", label: "Institution", icon: IconBuilding },
  { id: "branding", label: "Branding", icon: IconPalette },
  { id: "automation", label: "Automation", icon: IconRobot },
  { id: "decision-safety", label: "Decision Safety", icon: IconShieldCheck },
  { id: "reviewer", label: "Reviewer", icon: IconUserCheck },
  { id: "email", label: "Email", icon: IconMail },
  { id: "ai", label: "AI Configuration", icon: IconCpu },
];

// How far below the top of the window a section counts as "here": the app header and the tab bar.
const NAV_OFFSET = 140;

/**
 * Tabs that stay at the top while the page scrolls: a click scrolls to that section, and the tab of
 * the section in view lights up as you scroll.
 */
function SectionNav({ warnings = {} }: { warnings?: Record<string, string> }) {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const onScroll = () => {
      // At the very bottom the last section may be too short to reach the top: pick it anyway.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const current = atBottom
        ? SECTIONS[SECTIONS.length - 1]
        : [...SECTIONS]
            .reverse()
            .find(
              ({ id }) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= NAV_OFFSET
            );
      setActive((current ?? SECTIONS[0]).id);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (id: string) => {
    setActive(id);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    // The wrapper is page coloured, so nothing scrolls into view between the header and the bar.
    <div className={classes.nav}>
      <Card withBorder radius="lg" shadow="xs" padding={6}>
        <Group
          gap={4}
          wrap="nowrap"
          className={classes.navList}
          role="tablist"
          aria-label="Settings sections"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <UnstyledButton
              key={id}
              role="tab"
              aria-selected={active === id}
              data-active={active === id || undefined}
              className={classes.navItem}
              onClick={() => goTo(id)}
            >
              <Group gap={6} wrap="nowrap">
                <Icon size={16} />
                <Text size="sm" fw={500}>
                  {label}
                </Text>
                {/* Something here needs doing, e.g. no OpenAI key yet. */}
                {warnings[id] && (
                  <Tooltip label={warnings[id]}>
                    <Indicator color="orange" size={8} processing position="middle-end" inline>
                      <span style={{ display: "block", width: 8 }} />
                    </Indicator>
                  </Tooltip>
                )}
              </Group>
            </UnstyledButton>
          ))}
        </Group>
      </Card>
    </div>
  );
}

/** A settings section: what it is on the left, its fields on the right (stacked on small screens). */
function Section({
  id,
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  id: string;
  icon: typeof IconBuilding;
  title: string;
  description: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} withBorder radius="lg" shadow="xs" padding="lg" className={classes.section}>
      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap={6}>
            <Group gap="xs">
              <Icon size={18} color="var(--mantine-color-primary-6)" />
              <Title order={4} fz={16}>
                {title}
              </Title>
              {badge}
            </Group>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">{children}</Stack>
        </Grid.Col>
      </Grid>
    </Card>
  );
}

export default function Settings() {
  const can = useCan();
  const canEdit = can("settings", "update");
  const settings = useSettings();
  const options = useSettingsOptions();
  const save = useSaveSettings();
  const testEmail = useSendTestEmail();
  const [testTo, setTestTo] = useState("");
  const [replacingKey, setReplacingKey] = useState(false); // the New key field under a saved key

  const form = useForm<TFormValues>({
    initialValues: toFormValues(undefined),
    validate: {
      name: (value) => (value.trim() ? null : "Institution name is required"),
      contactEmail: (value) => (!value || isEmail(value) ? null : "Enter a valid email"),
      website: (value) =>
        !value.trim() || /^https?:\/\/\S+$/.test(value.trim())
          ? null
          : "Enter a full address starting with https://",
      brandColor: (value) =>
        !value.trim() || isBrandColor(value.trim()) ? null : "Enter a colour like #1E3A8A",
      phone: (value) => (!value.trim() || isPhone(value) ? null : PHONE_ERROR),
      smtpHost: (value, values) => (values.smtpEnabled && !value.trim() ? "Enter the SMTP server" : null),
      smtpPort: (value, values) => (values.smtpEnabled && value === "" ? "Enter the SMTP port" : null),
      smtpFromEmail: (value, values) =>
        values.smtpEnabled && !value.trim()
          ? "Enter the address emails are sent from"
          : value.trim() && !isEmail(value.trim())
            ? "Enter a valid email"
            : null,
      smtpPassword: (value, values) =>
        values.smtpEnabled &&
        values.smtpUser.trim() &&
        !value &&
        (!settings.data?.smtpPasswordSet || values.removeSmtpPassword)
          ? "Enter the SMTP password"
          : null,
      openaiApiKey: (value) =>
        !value.trim() || value.trim().startsWith("sk-")
          ? null
          : "Enter a valid OpenAI API key (it starts with sk-)",
    },
  });

  // Fill the form once the settings load, and again only when a save changes them (updatedAt), so a
  // background refetch never wipes edits in progress.
  useResetOnOpen(form, Boolean(settings.data), settings.data?.updatedAt, toFormValues(settings.data));

  // A switch row: label and description on the left, the switch on the right.
  const switchRow = (
    field: TSwitchField,
    label: string,
    description: string,
    onChange?: (on: boolean) => void
  ) => (
    <Group key={field} justify="space-between" wrap="nowrap" gap="xl" className={classes.switchRow}>
      <div>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
        {form.errors[field] && (
          <Text size="xs" c="red" mt={4}>
            {form.errors[field]}
          </Text>
        )}
      </div>
      <Switch
        checked={form.values[field]}
        onChange={(event) =>
          onChange
            ? onChange(event.currentTarget.checked)
            : form.setFieldValue(field, event.currentTarget.checked)
        }
        disabled={!canEdit}
        aria-label={label}
      />
    </Group>
  );

  // Auto-approving rejections only works without required approval, so one turns the other off.
  const setAutoApproveRejections = (on: boolean) =>
    form.setValues(
      on ? { autoApproveRejections: true, requireRejectionApproval: false } : { autoApproveRejections: false }
    );
  const setRequireRejectionApproval = (on: boolean) =>
    form.setValues(
      on
        ? { requireRejectionApproval: true, autoApproveRejections: false }
        : { requireRejectionApproval: false }
    );

  // Grouped by provider; a provider the app can't call yet (Claude) shows as Coming soon.
  const modelOptions = modelGroups(options.data?.aiModels ?? [], (model) => ({
    value: String(model.id),
    label: model.name,
    description:
      model.available === false
        ? "Coming soon"
        : [model.description, formatModelPrice(model)].filter(Boolean).join(" · "),
  }));
  const reviewerOptions = (options.data?.reviewers ?? []).map((reviewer) => ({
    value: String(reviewer.id),
    label: reviewer.name,
    description: `${reviewer.roleName} · ${reviewer.email}`,
  }));

  const modelSelect = (field: keyof TFormValues, label: string, description: string) => (
    <SearchableSelect
      label={label}
      description={description}
      withAsterisk
      placeholder={options.isLoading ? "Loading..." : "Select model"}
      searchPlaceholder="Search models..."
      nothingFoundMessage="No model found"
      leftSection={<IconCpu size={16} />}
      data={modelOptions}
      value={(form.values[field] as string) || null}
      onChange={(value) => value && form.setFieldValue(field, value)}
      error={form.errors[field]}
      disabled={!canEdit}
    />
  );

  const handleSubmit = form.onSubmit((values) =>
    save.mutate(toBody(values), {
      onSuccess: () =>
        notifications.show({ color: "green", title: "Settings saved", message: values.name.trim() }),
      // Threshold errors come back under the API's names (percentFieldOf).
      onError: (error) =>
        applyFormError(form, error, { fieldMap: percentFieldOf, toastTitle: "Could not save settings" }),
    })
  );

  const dirty = canEdit && form.isDirty();
  const savedKey = settings.data?.openaiApiKey ?? null;
  const keyState = form.values.removeApiKey
    ? { ok: false, tip: "The key is removed when you save; AI stops until a new one is added." }
    : savedKey
      ? { ok: true, tip: "Connected: AI assessment and document reading use this key." }
      : {
          ok: false,
          tip: "No OpenAI key yet: AI assessment and document reading can't run until you add one.",
        };
  const keyLabel = (
    <Group gap={6} component="span" display="inline-flex" wrap="nowrap">
      OpenAI API Key
      <Tooltip label={keyState.tip} multiline maw={280}>
        {keyState.ok ? (
          <IconCircleCheckFilled
            size={16}
            style={{ color: "var(--mantine-color-green-6)" }}
            aria-label={keyState.tip}
          />
        ) : (
          <IconAlertTriangleFilled
            size={16}
            style={{ color: "var(--mantine-color-orange-6)" }}
            aria-label={keyState.tip}
          />
        )}
      </Tooltip>
    </Group>
  );
  // A saved (or removed) key closes the Replace field again.
  useEffect(() => setReplacingKey(false), [savedKey]);
  const sender = settings.data?.emailSender;
  // The sender's name and address: as the API sends them apart, else read from "Name <address>".
  const fromMatch = sender?.from?.match(/^(.*?)\s*<([^>]+)>$/);
  const from = sender?.address
    ? { name: sender.name || sender.address, address: sender.name ? sender.address : null }
    : sender?.from
      ? fromMatch
        ? { name: fromMatch[1] || fromMatch[2], address: fromMatch[1] ? fromMatch[2] : null }
        : { name: sender.from, address: null }
      : null;

  // Uses the saved settings, so unsaved changes must be saved first.
  const sendTest = () =>
    testEmail.mutate(testTo.trim(), {
      onSuccess: ({ sentTo, sender: used }) =>
        notifications.show({
          color: "green",
          title: "Test email sent",
          message: `Sent to ${sentTo} through ${used === "custom" ? "your email server" : "Firmli's email server"}.`,
        }),
      // A refusing server's reason comes in the message ("Invalid login: 535 ..."): shown as it is.
      onError: (error) => errorHandler(error, "Test email failed"),
    });

  return (
    <Page>
      <PageHeader
        title="Settings"
        description={
          settings.data
            ? `How ${settings.data.name} works in the app. Last saved ${formatDateTime(settings.data.updatedAt)}.`
            : "How your institution works in the app."
        }
      />

      {settings.isLoading ? (
        [6, 4].map((fields) => (
          <Card key={fields} withBorder radius="lg" shadow="xs" padding="lg">
            <FormSkeleton fields={fields} />
          </Card>
        ))
      ) : settings.error ? (
        <Card withBorder radius="lg" shadow="xs" padding={0}>
          <ErrorState error={settings.error} title="Could not load settings" />
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <SectionNav
              warnings={settings.data && !settings.data.aiConfigured ? { ai: "No OpenAI key yet" } : {}}
            />
            {!canEdit && (
              <Alert variant="light" color="gray" icon={<IconLock size={18} />}>
                Your role can view these settings but not change them.
              </Alert>
            )}

            <Section
              id="institution"
              icon={IconBuilding}
              title="Institution Details"
              description="Your institution as students and staff see it. The name also shows in the app header."
            >
              {/* Hints sit under their fields, so the two fields of a row stay level. */}
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Institution Name"
                  placeholder="e.g. Firmli University"
                  withAsterisk
                  maxLength={150}
                  disabled={!canEdit}
                  {...form.getInputProps("name")}
                />
                <TextInput
                  label="Institution Code"
                  value={settings.data?.code ?? "—"}
                  description="Set by the Firmli team"
                  inputWrapperOrder={HINT_BELOW}
                  readOnly
                  disabled
                />
                <TextInput
                  label="Contact Email"
                  placeholder="e.g. admissions@university.edu"
                  leftSection={<IconMail size={16} />}
                  disabled={!canEdit}
                  {...form.getInputProps("contactEmail")}
                />
                <TextInput
                  label="Phone"
                  placeholder="e.g. +91 98765 43210"
                  description={PHONE_HINT}
                  inputWrapperOrder={HINT_BELOW}
                  leftSection={<IconPhone size={16} />}
                  maxLength={30}
                  disabled={!canEdit}
                  {...form.getInputProps("phone")}
                />
                <TextInput
                  label="Website"
                  placeholder="e.g. https://www.university.edu"
                  description="Also {{institution_website}} in letters and emails"
                  inputWrapperOrder={HINT_BELOW}
                  leftSection={<IconWorld size={16} />}
                  maxLength={255}
                  disabled={!canEdit}
                  {...form.getInputProps("website")}
                />
                <Textarea
                  label="Address"
                  placeholder="e.g. 12 College Road, Ludhiana, Punjab 141001"
                  autosize
                  minRows={2}
                  maxLength={500}
                  disabled={!canEdit}
                  {...form.getInputProps("address")}
                />
              </SimpleGrid>
            </Section>

            <Section
              id="branding"
              icon={IconPalette}
              title="Letter Branding"
              description="Every letter PDF is printed on your letterhead: your logo, your details and your brand colour. Letters made before a change keep how they looked."
            >
              <BrandingFields
                logo={settings.data?.logo ?? null}
                details={form.values}
                colorProps={form.getInputProps("brandColor")}
                canEdit={canEdit}
              />
            </Section>

            <Section
              id="automation"
              icon={IconRobot}
              title="Automation"
              description="What happens on its own when an application comes in."
            >
              <div>
                {switchRow(
                  "autoAssessment",
                  "Automatic assessment",
                  "Check each new application against its program's eligibility rules right away."
                )}
                {switchRow(
                  "autoLetterGeneration",
                  "Automatic letter generation",
                  "Generate the letter as soon as an application is decided, by the AI or a person."
                )}
                {switchRow(
                  "autoEmailDispatch",
                  "Automatic email dispatch",
                  "Email the letter to the student as soon as it is approved."
                )}
              </div>
            </Section>

            <Section
              id="decision-safety"
              icon={IconShieldCheck}
              title="Decision Safety"
              description="When a person must look before a decision goes out, and how sure the AI must be."
            >
              <div>
                {switchRow(
                  "autoApproveOffers",
                  "Auto-approve conditional offers",
                  "Offers the AI is sure about go out without a review."
                )}
                {switchRow(
                  "autoApproveRejections",
                  "Auto-approve rejections",
                  "Rejections the AI is sure about go out without a review. Turns off required approval.",
                  setAutoApproveRejections
                )}
                {switchRow(
                  "requireRejectionApproval",
                  "Always require approval for rejections",
                  "Every rejection waits for a person to approve it.",
                  setRequireRejectionApproval
                )}
                {switchRow(
                  "requireManualReviewEdgeCases",
                  "Require manual review for edge cases",
                  "Unclear applications go to a reviewer instead of getting a decision."
                )}
                {switchRow(
                  "flagLowConfidence",
                  "Flag low-confidence assessments",
                  "Mark assessments below the confidence levels below for a closer look."
                )}
                {switchRow(
                  "flagMissingDocuments",
                  "Flag missing documents",
                  "Mark applications that lack a required document."
                )}
              </div>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <NumberInput
                  label="Offer Confidence"
                  description="How sure the AI must be to approve an offer"
                  suffix="%"
                  min={0}
                  max={100}
                  clampBehavior="strict"
                  allowDecimal={false}
                  disabled={!canEdit}
                  {...form.getInputProps("offerConfidence")}
                />
                <NumberInput
                  label="Rejection Confidence"
                  description="How sure the AI must be to approve a rejection"
                  suffix="%"
                  min={0}
                  max={100}
                  clampBehavior="strict"
                  allowDecimal={false}
                  disabled={!canEdit}
                  {...form.getInputProps("rejectionConfidence")}
                />
              </SimpleGrid>
            </Section>

            <Section
              id="reviewer"
              icon={IconUserCheck}
              title="Default Reviewer"
              description="Who gets an application that needs a person when nobody has been assigned."
            >
              <SearchableSelect
                label="Default Reviewer"
                description="Users of your institution who can log in"
                placeholder={options.isLoading ? "Loading..." : "No default reviewer"}
                searchPlaceholder="Search users..."
                nothingFoundMessage="No user found"
                leftSection={<IconUserCheck size={16} />}
                data={reviewerOptions}
                value={form.values.defaultReviewerId}
                onChange={(value) => form.setFieldValue("defaultReviewerId", value)}
                error={form.errors.defaultReviewerId}
                clearable
                disabled={!canEdit}
                w={{ base: "100%", sm: 360 }}
              />
            </Section>

            <Section
              id="email"
              icon={IconMail}
              title="Email"
              description="Who students get emails from, and how hard to try failed ones."
              badge={
                sender?.type === "custom" ? (
                  <Badge variant="light" color="green" size="sm">
                    Own server
                  </Badge>
                ) : (
                  <Badge variant="light" color="gray" size="sm">
                    Firmli server
                  </Badge>
                )
              }
            >
              {/* The sender as it works now (saved settings), like an email's From line, and a test of it. */}
              <Card withBorder radius="md" padding={0}>
                <Group gap="sm" wrap="nowrap" align="flex-start" p="md">
                  <ThemeIcon size={40} radius="xl" variant="light" color={from ? "primary" : "orange"}>
                    <IconMail size={20} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text size="xs" c="dimmed">
                      Students see emails from
                    </Text>
                    {from ? (
                      <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                        {from.name}{" "}
                        {from.address && (
                          <Text span size="sm" fw={400} c="dimmed">
                            &lt;{from.address}&gt;
                          </Text>
                        )}
                      </Text>
                    ) : (
                      <Text fw={600}>Not set up yet</Text>
                    )}
                    <Group gap="md" mt={6} className={classes.senderFacts}>
                      <Group gap={4} wrap="nowrap" align="flex-start">
                        <IconServer size={14} aria-hidden />
                        {sender?.type === "custom"
                          ? "Through your own email server"
                          : "Through Firmli's email server"}
                      </Group>
                      <Group gap={4} wrap="nowrap" align="flex-start">
                        <IconArrowBackUp size={14} aria-hidden />
                        {settings.data?.contactEmail
                          ? `Replies go to ${settings.data.contactEmail}`
                          : "Add a Contact Email to get replies"}
                      </Group>
                    </Group>
                  </div>
                </Group>
                {canEdit && (
                  <Group gap="xs" className={classes.testRow}>
                    <TextInput
                      placeholder="Send a test to... (empty: your email)"
                      leftSection={<IconAt size={16} />}
                      value={testTo}
                      onChange={(event) => setTestTo(event.currentTarget.value)}
                      style={{ flex: "1 1 220px" }}
                      aria-label="Test email address"
                    />
                    <Tooltip label="Save your changes first" disabled={!dirty}>
                      <Button
                        variant="secondary"
                        leftSection={<IconSend size={16} />}
                        onClick={() => !dirty && sendTest()}
                        loading={testEmail.isPending}
                        data-disabled={dirty || undefined}
                      >
                        Send Test Email
                      </Button>
                    </Tooltip>
                  </Group>
                )}
              </Card>

              <OptionCards
                label="Send emails through"
                data={[
                  {
                    value: "default",
                    label: "Firmli's email server",
                    description: "No setup. Sent in your institution's name.",
                    icon: <IconCloud size={18} />,
                  },
                  {
                    value: "custom",
                    label: "Your own email server",
                    description: "From your own address, through your mail provider (SMTP).",
                    icon: <IconServer size={18} />,
                  },
                ]}
                value={form.values.smtpEnabled ? "custom" : "default"}
                onChange={(value) => form.setFieldValue("smtpEnabled", value === "custom")}
                description={
                  !form.values.smtpEnabled && form.values.smtpHost
                    ? "Your server's details are kept for when you switch back."
                    : undefined
                }
                disabled={!canEdit}
                cols={2}
              />

              {form.values.smtpEnabled && (
                <Stack gap="md" className={classes.subPanel}>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="SMTP Server"
                      placeholder="e.g. smtp.sendgrid.net"
                      description="Your mail provider's server"
                      withAsterisk
                      leftSection={<IconServer size={16} />}
                      disabled={!canEdit}
                      {...form.getInputProps("smtpHost")}
                    />
                    <NumberInput
                      label="Port"
                      placeholder="e.g. 587"
                      description="Usually 587, or 465 with SSL"
                      leftSection={<IconPlugConnected size={16} />}
                      withAsterisk
                      min={1}
                      max={65535}
                      allowDecimal={false}
                      hideControls
                      disabled={!canEdit}
                      {...form.getInputProps("smtpPort")}
                    />
                    <TextInput
                      label="Username"
                      placeholder="e.g. apikey"
                      description="If the server needs a login"
                      leftSection={<IconUser size={16} />}
                      disabled={!canEdit}
                      {...form.getInputProps("smtpUser")}
                    />
                    {form.values.removeSmtpPassword ? (
                      <Alert variant="light" color="orange" title="Password will be removed">
                        <Anchor
                          component="button"
                          type="button"
                          size="sm"
                          onClick={() => form.setFieldValue("removeSmtpPassword", false)}
                        >
                          Keep the saved password
                        </Anchor>
                      </Alert>
                    ) : (
                      <PasswordInput
                        label="Password"
                        placeholder={
                          settings.data?.smtpPasswordSet
                            ? "Leave empty to keep the saved one"
                            : "Your SMTP password"
                        }
                        leftSection={<IconLock size={16} />}
                        description={
                          settings.data?.smtpPasswordSet ? (
                            <>
                              A password is saved; it is never shown.{" "}
                              {canEdit && (
                                <Anchor
                                  component="button"
                                  type="button"
                                  size="xs"
                                  c="red"
                                  onClick={() =>
                                    form.setValues({ removeSmtpPassword: true, smtpPassword: "" })
                                  }
                                >
                                  Remove it
                                </Anchor>
                              )}
                            </>
                          ) : (
                            "Needed with a username"
                          )
                        }
                        disabled={!canEdit}
                        {...form.getInputProps("smtpPassword")}
                      />
                    )}
                    <TextInput
                      label="From Email"
                      placeholder="e.g. admissions@university.edu"
                      description="The address students see"
                      withAsterisk
                      leftSection={<IconMail size={16} />}
                      disabled={!canEdit}
                      {...form.getInputProps("smtpFromEmail")}
                    />
                    <TextInput
                      label="From Name"
                      placeholder={form.values.name || "Your institution's name"}
                      description="Leave empty to use the institution name"
                      leftSection={<IconBuilding size={16} />}
                      disabled={!canEdit}
                      {...form.getInputProps("smtpFromName")}
                    />
                  </SimpleGrid>
                  <div>
                    {switchRow(
                      "smtpSecure",
                      "Secure connection (SSL)",
                      "On for port 465. Port 587 usually works with it off."
                    )}
                  </div>
                  <Text size="xs" c="dimmed">
                    Save, then use Send Test Email above to check the server works.
                  </Text>
                </Stack>
              )}

              {/* A number, set once: a compact row like the switches. */}
              <Group justify="space-between" wrap="nowrap" gap="xl" className={classes.switchRow}>
                <div>
                  <Text size="sm" fw={500}>
                    Max Retry Attempts
                  </Text>
                  <Text size="xs" c="dimmed">
                    How many times a failed email is tried again by itself, minutes then hours apart (0 to{" "}
                    {MAX_EMAIL_RETRIES}).
                  </Text>
                </div>
                <NumberInput
                  aria-label="Max Retry Attempts"
                  min={0}
                  max={MAX_EMAIL_RETRIES}
                  clampBehavior="strict"
                  allowDecimal={false}
                  disabled={!canEdit}
                  w={96}
                  style={{ flexShrink: 0 }}
                  {...form.getInputProps("emailMaxRetries")}
                />
              </Group>
            </Section>

            <Section
              id="ai"
              icon={IconCpu}
              title="AI Configuration"
              description="The models that read documents and assess applications, and their instructions."
              badge={
                settings.data?.aiConfigured ? (
                  <Badge variant="light" color="green" size="sm">
                    AI Active
                  </Badge>
                ) : (
                  <Badge variant="light" color="orange" size="sm">
                    AI not set up
                  </Badge>
                )
              }
            >
              {/* One field: its label carries the key's state (hover for the details). Write only: the
                  API sends back a masked key, so a new key is typed in only to set or replace it. */}
              {form.values.removeApiKey ? (
                <TextInput
                  label={keyLabel}
                  description="AI assessment and document reading stop until a new key is added."
                  value="Removed when you save"
                  readOnly
                  leftSection={<IconKey size={16} />}
                  rightSectionWidth={110}
                  rightSection={
                    <Button
                      variant="tertiary"
                      size="compact-xs"
                      onClick={() => form.setFieldValue("removeApiKey", false)}
                    >
                      Keep Key
                    </Button>
                  }
                  styles={{ input: { color: "var(--mantine-color-orange-7)" } }}
                />
              ) : savedKey && !replacingKey ? (
                <TextInput
                  label={keyLabel}
                  description="Saved and encrypted; only its last characters are shown."
                  value={savedKey}
                  readOnly
                  leftSection={<IconKey size={16} />}
                  rightSectionWidth={canEdit ? 160 : undefined}
                  rightSection={
                    canEdit && (
                      <Group gap={4} wrap="nowrap">
                        <Button
                          variant="tertiary"
                          size="compact-xs"
                          leftSection={<IconRefresh size={12} />}
                          onClick={() => setReplacingKey(true)}
                        >
                          Replace
                        </Button>
                        <Button
                          variant="tertiary"
                          size="compact-xs"
                          c="red"
                          onClick={() => form.setValues({ removeApiKey: true, openaiApiKey: "" })}
                        >
                          Remove
                        </Button>
                      </Group>
                    )
                  }
                  styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
                />
              ) : (
                <PasswordInput
                  label={keyLabel}
                  description={
                    savedKey ? (
                      <>
                        Replaces the saved key when you save.{" "}
                        <Anchor
                          component="button"
                          type="button"
                          size="xs"
                          onClick={() => setReplacingKey(false)}
                        >
                          Keep the saved key
                        </Anchor>
                      </>
                    ) : (
                      "Your institution's own key from platform.openai.com. Stored encrypted."
                    )
                  }
                  placeholder="sk-..."
                  leftSection={<IconKey size={16} />}
                  disabled={!canEdit}
                  data-autofocus={replacingKey || undefined}
                  {...form.getInputProps("openaiApiKey")}
                />
              )}
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {modelSelect("extractionModelId", "Extraction Model", "Reads the documents")}
                {modelSelect(
                  "extractionFallbackModelId",
                  "Extraction Fallback",
                  "Used when the first one fails"
                )}
                {modelSelect("assessmentModelId", "Assessment Model", "Checks the eligibility rules")}
                {modelSelect("assessmentEscalationModelId", "Assessment Escalation", "For hard cases")}
              </SimpleGrid>
              <div>
                {switchRow(
                  "verifyDocumentType",
                  "Verify document type",
                  "Check that each upload is the document it claims to be."
                )}
              </div>
              <Textarea
                label="Custom Extraction Prompt"
                description="Leave empty to use the built-in prompt. May use {category}."
                placeholder="Built-in prompt"
                autosize
                minRows={3}
                maxRows={12}
                maxLength={MAX_PROMPT_LENGTH}
                disabled={!canEdit}
                {...form.getInputProps("extractionPrompt")}
              />
              <Textarea
                label="Custom Assessment Prompt"
                description="Leave empty to use the built-in prompt."
                placeholder="Built-in prompt"
                autosize
                minRows={3}
                maxRows={12}
                maxLength={MAX_PROMPT_LENGTH}
                disabled={!canEdit}
                {...form.getInputProps("assessmentPrompt")}
              />
            </Section>

            {dirty && (
              <Card withBorder radius="lg" padding="md" className={classes.saveBar}>
                <Group justify="space-between" gap="sm">
                  <Text size="sm" fw={500}>
                    You have unsaved changes
                  </Text>
                  <Group gap="sm">
                    <Button variant="secondary" onClick={form.reset} disabled={save.isPending}>
                      Discard
                    </Button>
                    <Button type="submit" loading={save.isPending}>
                      Save Changes
                    </Button>
                  </Group>
                </Group>
              </Card>
            )}
          </Stack>
        </form>
      )}
    </Page>
  );
}
