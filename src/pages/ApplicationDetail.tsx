import { ReactNode, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconEdit,
  IconFileText,
  IconHistory,
  IconLayoutGrid,
  IconLock,
  IconMail,
  IconMessage,
  IconRobot,
  IconTrash,
  IconUserCheck,
} from "@tabler/icons-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Field, SectionCard } from "../components/Field";
import RecordUnavailable from "../components/RecordUnavailable";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import SearchableSelect from "../components/SearchableSelect";
import { CardSkeleton, FormSkeleton } from "../components/Skeletons";
import { confirmDanger } from "../components/confirm";
import {
  IApplication,
  applicationStatusColors,
  outcomeColors,
  useApplication,
  useApplicationOptions,
  useDeleteApplication,
  useSetOfficer,
} from "../lib/applications";
import { useCan } from "../lib/auth";
import errorHandler from "../lib/errors";
import { useApplicationNotes } from "../lib/notes";
import { studyModeLabels } from "../lib/programs";
import { formatDate, formatDateTime } from "../lib/utils";
import { RO_APPLICATIONS, editApplicationPath } from "../routes";
import ApplicationActivity from "./ApplicationActivity";
import ApplicationAssessment from "./ApplicationAssessment";
import ApplicationDocuments from "./ApplicationDocuments";
import ApplicationEmails from "./ApplicationEmails";
import { ApplicationJourney, NextStep, TApplicationTab } from "./ApplicationJourney";
import ApplicationLetters from "./ApplicationLetters";
import ApplicationNotes from "./ApplicationNotes";
import ChangeOutcomeForm from "./ChangeOutcomeForm";

const TABS: TApplicationTab[] = ["overview", "assessment", "documents", "letter", "notes", "activity"];

/** The student's details that were given; the empty ones in one line, not as rows of dashes. */
function StudentSection({ app, genderLabel }: { app: IApplication; genderLabel: string | null }) {
  const { student } = app;
  const fields: [string, ReactNode][] = [
    ["Email", student.email],
    ["Phone", student.phone],
    ["Date of Birth", student.dateOfBirth && formatDate(student.dateOfBirth)],
    ["Gender", genderLabel],
    ["Nationality", student.nationality?.name],
    ["Country of Residence", student.residenceCountry?.name],
    ["Passport Number", student.passportNumber],
    ["Address", student.address],
  ];
  const given = fields.filter(([, value]) => value);
  const missing = fields.filter(([, value]) => !value).map(([label]) => label);
  return (
    // Fills the rest of the column, so it ends level with the Application card beside it.
    <SectionCard title="Student" style={{ flex: 1 }}>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="md">
        {given.map(([label, value]) => (
          <Field key={label} label={label}>
            {value}
          </Field>
        ))}
      </SimpleGrid>
      {missing.length > 0 && (
        <Text size="xs" c="dimmed" mt="md">
          Not given: {missing.join(", ")}.
        </Text>
      )}
    </SectionCard>
  );
}

/**
 * One application: where it stands (the journey and the next step), then tabs: Overview (student,
 * decision, program, officer), Assessment, Documents, Letter & Emails, Notes and Activity. ?tab= keeps
 * the open tab in the URL.
 */
export default function ApplicationDetail() {
  const params = useParams();
  const id = Number(params.id);
  const navigate = useNavigate();
  const can = useCan();
  const [searchParams, setSearchParams] = useSearchParams();
  const application = useApplication(id);
  const options = useApplicationOptions();
  const notes = useApplicationNotes(id);
  const setOfficer = useSetOfficer();
  const deleteDraft = useDeleteApplication();
  const [changingOutcome, setChangingOutcome] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tab: TApplicationTab = TABS.find((value) => value === searchParams.get("tab")) ?? "overview";

  const label = <T extends string>(list: { value: T; label: string }[] | undefined, value: T | null) =>
    value ? (list?.find((item) => item.value === value)?.label ?? value) : null;

  const openTab = (next: TApplicationTab, scroll = false) => {
    setSearchParams(
      (current) => {
        if (next === "overview") current.delete("tab");
        else current.set("tab", next);
        return current;
      },
      { replace: true }
    );
    if (scroll) tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (application.isLoading) {
    return (
      <Page>
        <CardSkeleton />
        <Card withBorder radius="lg" shadow="xs" padding="lg">
          <FormSkeleton />
        </Card>
      </Page>
    );
  }

  if (application.error || !application.data) {
    return (
      <Page>
        <PageHeader title="Application" parent={{ label: "Applications", to: RO_APPLICATIONS }} />
        <RecordUnavailable
          error={application.error}
          noun="application"
          list={{ label: "Applications", to: RO_APPLICATIONS }}
        />
      </Page>
    );
  }

  const app = application.data;
  const isDraft = app.status === "draft";
  const missing = app.missingDocuments ?? [];
  const showLetterTab = !isDraft && (can("letters", "read") || can("communications", "read"));

  const confirmDelete = () =>
    confirmDanger({
      title: "Delete draft",
      message: (
        <>
          Delete the draft <b>{app.applicationNumber}</b> for {app.student.fullName}? Its uploaded files go
          too.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteDraft.mutate(app.id, {
          onSuccess: () => {
            notifications.show({ color: "green", title: "Draft deleted", message: app.applicationNumber });
            navigate(RO_APPLICATIONS, { replace: true });
          },
          onError: (error) => errorHandler(error, "Could not delete the draft"),
        }),
    });

  const assignOfficer = (value: string | null) =>
    setOfficer.mutate(
      { id: app.id, officerId: value ? Number(value) : null },
      {
        onSuccess: (saved) =>
          notifications.show({
            color: "green",
            title: saved.officer ? "Officer assigned" : "Officer removed",
            message: saved.officer
              ? `${saved.officer.name} · ${saved.applicationNumber}`
              : saved.applicationNumber,
          }),
        onError: (error) => errorHandler(error, "Could not set the officer"),
      }
    );

  const count = (value: number | undefined) =>
    value ? (
      <Text span c="dimmed" size="sm">
        {value}
      </Text>
    ) : null;

  return (
    <Page>
      <PageHeader
        parent={{ label: "Applications", to: RO_APPLICATIONS }}
        title={app.student.fullName}
        badge={
          <Badge variant="light" color={applicationStatusColors[app.status]} size="lg">
            {label(options.data?.statuses, app.status)}
          </Badge>
        }
        description={`${app.applicationNumber} · ${app.program.name} · ${app.intake}`}
        action={
          app.status === "completed" && app.outcome !== "manual_review" && can("applications", "update") ? (
            <Button
              variant="secondary"
              leftSection={<IconArrowsExchange size={16} />}
              onClick={() => setChangingOutcome(true)}
            >
              Change Outcome
            </Button>
          ) : (
            isDraft && (
              <Group gap="sm">
                {can("applications", "delete") && (
                  <Button variant="secondary" leftSection={<IconTrash size={16} />} onClick={confirmDelete}>
                    Delete Draft
                  </Button>
                )}
                {can("applications", "update") && (
                  <Button
                    component={Link}
                    to={editApplicationPath(app.id)}
                    leftSection={<IconEdit size={16} />}
                  >
                    Continue Editing
                  </Button>
                )}
              </Group>
            )
          )
        }
      />

      {/* Where it stands, and what to do now */}
      <ApplicationJourney application={app} />
      <NextStep application={app} onOpenTab={(next) => openTab(next, true)} />

      <div ref={tabsRef} style={{ scrollMarginTop: 80 }}>
        <Tabs
          value={tab}
          onChange={(value) => openTab((value as TApplicationTab) ?? "overview")}
          keepMounted={false}
        >
          <Tabs.List mb="lg">
            <Tabs.Tab value="overview" leftSection={<IconLayoutGrid size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="assessment" leftSection={<IconRobot size={16} />}>
              Assessment
            </Tabs.Tab>
            <Tabs.Tab
              value="documents"
              leftSection={<IconFileText size={16} />}
              rightSection={
                missing.length > 0 ? (
                  <Badge size="xs" color="orange" variant="filled" circle>
                    {missing.length}
                  </Badge>
                ) : undefined
              }
            >
              Documents {count(app.documentCount)}
            </Tabs.Tab>
            {showLetterTab && (
              <Tabs.Tab value="letter" leftSection={<IconMail size={16} />}>
                Letter & Emails
              </Tabs.Tab>
            )}
            <Tabs.Tab value="notes" leftSection={<IconMessage size={16} />}>
              Notes {count(notes.data?.length)}
            </Tabs.Tab>
            <Tabs.Tab value="activity" leftSection={<IconHistory size={16} />}>
              Activity
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview">
            <Grid gutter="lg">
              {/* Side by side only on a wide screen: at 8 / 4 on a smaller one, dates wrap onto three lines. */}
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Stack gap="lg" h="100%">
                  {/* One line: the Next Step banner above is orange too, so this stays small. */}
                  {missing.length > 0 && (
                    <Alert
                      variant="light"
                      color="orange"
                      py="xs"
                      icon={<IconAlertTriangle size={18} />}
                      styles={{ wrapper: { alignItems: "center" } }}
                    >
                      <Group justify="space-between" gap="sm">
                        <Text size="sm">
                          <Text span fw={600} inherit>
                            {missing.length} required {missing.length === 1 ? "document is" : "documents are"}{" "}
                            missing:
                          </Text>{" "}
                          {missing.join(", ")}
                        </Text>
                        <Button size="xs" variant="secondary" onClick={() => openTab("documents")}>
                          Open Documents
                        </Button>
                      </Group>
                    </Alert>
                  )}

                  {app.outcome && (
                    <SectionCard title="Decision">
                      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                        <Field label="Outcome">
                          <Badge variant="light" color={outcomeColors[app.outcome]}>
                            {label(options.data?.outcomes, app.outcome)}
                          </Badge>
                        </Field>
                        <Field label="AI Confidence">
                          {app.confidence !== null && `${Math.round(app.confidence * 100)}%`}
                        </Field>
                        <Field label="Decided By">
                          {app.decision &&
                            (app.decision.source === "ai"
                              ? "AI assessment"
                              : (app.decision.by?.name ?? "A person"))}
                        </Field>
                        <Field label="When">{app.decision?.at && formatDateTime(app.decision.at)}</Field>
                      </SimpleGrid>
                      {app.decision?.reason && (
                        <Text size="sm" mt="md" c="dimmed">
                          Reason:{" "}
                          <Text span c="var(--mantine-color-text)">
                            {app.decision.reason}
                          </Text>
                        </Text>
                      )}
                    </SectionCard>
                  )}

                  <StudentSection app={app} genderLabel={label(options.data?.genders, app.student.gender)} />
                </Stack>
              </Grid.Col>

              {/* Program, officer and dates in one card, so this column is about as tall as the left one. */}
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <SectionCard title="Application">
                  <Stack gap="md">
                    <Field label="Program">{`${app.program.name} (${app.program.code})`}</Field>
                    <SimpleGrid cols={{ base: 2, sm: 4, lg: 2 }} spacing="md">
                      <Field label="Intake">{app.intake}</Field>
                      <Field label="Study Mode">{studyModeLabels[app.studyMode]}</Field>
                      <Field label="Application Date">{formatDate(app.applicationDate)}</Field>
                      <Field label="Criteria">
                        {app.eligibilityVersion ? (
                          <Group gap={6}>
                            v{app.eligibilityVersion.versionNumber}
                            {app.eligibilityVersion.locked && (
                              <Badge
                                size="xs"
                                variant="light"
                                color="gray"
                                leftSection={<IconLock size={10} />}
                              >
                                Locked
                              </Badge>
                            )}
                          </Group>
                        ) : (
                          "None published"
                        )}
                      </Field>
                    </SimpleGrid>

                    <Divider />
                    {/* The officer can be set at any status. */}
                    <SearchableSelect
                      label="Officer"
                      description="Who looks after this application"
                      placeholder={options.isLoading ? "Loading..." : "Unassigned"}
                      searchPlaceholder="Search users..."
                      nothingFoundMessage="No user found"
                      leftSection={<IconUserCheck size={16} />}
                      data={(options.data?.officers ?? []).map((officer) => ({
                        value: String(officer.id),
                        label: officer.name,
                        description: `${officer.roleName} · ${officer.email}`,
                      }))}
                      value={app.officer ? String(app.officer.id) : null}
                      onChange={assignOfficer}
                      clearable
                      disabled={!can("applications", "update") || setOfficer.isPending}
                    />

                    <Divider />
                    <Field label="Submitted">
                      {app.submittedAt
                        ? `${formatDateTime(app.submittedAt)}${app.submittedBy ? ` by ${app.submittedBy.name}` : ""}`
                        : "Not yet"}
                    </Field>
                    <SimpleGrid cols={2} spacing="md">
                      <Field label="Created">{formatDateTime(app.createdAt)}</Field>
                      <Field label="Last Changed">{formatDateTime(app.updatedAt)}</Field>
                    </SimpleGrid>
                  </Stack>
                </SectionCard>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          {/* Always mounted, so a running assessment keeps updating on any tab; the others load when opened. */}
          <Tabs.Panel value="assessment" keepMounted>
            <ApplicationAssessment application={app} />
          </Tabs.Panel>

          <Tabs.Panel value="documents">
            <SectionCard title={`Documents (${app.documentCount})`}>
              <ApplicationDocuments
                application={app}
                editable={isDraft}
                addOnly={app.status === "manual_review"}
              />
            </SectionCard>
          </Tabs.Panel>

          {showLetterTab && (
            <Tabs.Panel value="letter">
              <Grid gutter="lg">
                {can("letters", "read") && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <ApplicationLetters application={app} />
                  </Grid.Col>
                )}
                {can("communications", "read") && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <ApplicationEmails applicationId={app.id} />
                  </Grid.Col>
                )}
              </Grid>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="notes">
            <ApplicationNotes applicationId={app.id} />
          </Tabs.Panel>

          <Tabs.Panel value="activity">
            <ApplicationActivity applicationId={app.id} />
          </Tabs.Panel>
        </Tabs>
      </div>

      <ChangeOutcomeForm
        application={changingOutcome ? app : null}
        onClose={() => setChangingOutcome(false)}
      />
    </Page>
  );
}
