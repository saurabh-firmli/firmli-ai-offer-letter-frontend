import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Indicator,
  Popover,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput, DatesRangeValue } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustmentsHorizontal,
  IconCalendar,
  IconDownload,
  IconFileText,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconSend,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import DataState from "../components/DataState";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { PersonCell } from "../components/TableCells";
import PageHeader from "../components/PageHeader";
import RowActions, { IRowAction, rowClick } from "../components/RowActions";
import StatusDot from "../components/StatusDot";
import SearchableSelect from "../components/SearchableSelect";
import { confirmDanger } from "../components/confirm";
import {
  IApplication,
  TApplicationStatus,
  TAssessmentStatus,
  TLetterFilter,
  TOutcome,
  applicationStatusColors,
  assessmentStatusColors,
  outcomeColors,
  useApplicationOptions,
  useApplications,
  useDeleteApplication,
} from "../lib/applications";
import { useCan } from "../lib/auth";
import { useRunAssessment } from "../lib/assessments";
import { letterStatusColors, openLetterPdf, useLetter } from "../lib/letters";
import errorHandler from "../lib/errors";
import { studyModeLabels } from "../lib/programs";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import { formatDate, toApiDate } from "../lib/utils";
import { RO_NEW_APPLICATION, applicationPath, editApplicationPath } from "../routes";
import { NO_AUTOFILL } from "../lib/forms";
import { canHaveLetter, useGenerateLetterAction } from "./ApplicationLetters";
import { SendEmailForm } from "./EmailView";

const PAGE_SIZE = 20;

// The application's current letter (More Filters); the labels are the letter statuses'.
const LETTER_FILTERS: { value: TLetterFilter; label: string }[] = [
  { value: "pending_approval", label: "Waiting for Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "none", label: "No letter" },
];

export default function Applications() {
  const can = useCan();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [programId, setProgramId] = useState<string | null>(null);
  // The bell opens this list filtered: ?status=submitted or ?assessmentStatus=failed.
  const [searchParams] = useSearchParams();
  const fromUrl = <T extends string>(key: string, allowed: Record<T, string>) =>
    (Object.keys(allowed) as T[]).find((value) => value === searchParams.get(key)) ?? null;
  const [status, setStatus] = useState<TApplicationStatus | null>(fromUrl("status", applicationStatusColors));
  const [outcome, setOutcome] = useState<TOutcome | null>(null);
  const [letterStatus, setLetterStatus] = useState<TLetterFilter | null>(null);
  // "More Filters"
  const [assessmentStatus, setAssessmentStatus] = useState<TAssessmentStatus | null>(
    fromUrl("assessmentStatus", assessmentStatusColors)
  );
  // Opened again from the bell while already here: take the new filter. The location key changes on
  // every navigation, so the same bell item clicked again after changing the filters applies it too.
  const urlFilter = searchParams.toString();
  const { key: locationKey } = useLocation();
  useEffect(() => {
    if (!urlFilter) return;
    setStatus(fromUrl("status", applicationStatusColors));
    setAssessmentStatus(fromUrl("assessmentStatus", assessmentStatusColors));
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter, locationKey]);
  const [officerId, setOfficerId] = useState<string | null>(null);
  const [intake, setIntake] = useState<string | null>(null); // "fall-2026"
  const [submitted, setSubmitted] = useState<DatesRangeValue>([null, null]);

  const options = useApplicationOptions();
  const programs = useDropdown("programs");
  const deleteDraft = useDeleteApplication();
  const runAssessment = useRunAssessment();
  const generateLetter = useGenerateLetterAction();
  // Send Email needs the whole letter (the student's name and email): loaded when it is picked.
  const [sendingLetterId, setSendingLetterId] = useState<number | null>(null);
  const sendingLetter = useLetter(sendingLetterId);
  useEffect(() => {
    if (!sendingLetter.error) return;
    errorHandler(sendingLetter.error, "Could not open the letter");
    setSendingLetterId(null);
  }, [sendingLetter.error]);
  const [intakeTerm, intakeYear] = intake ? intake.split("-") : [];

  const { data, isLoading, error } = useApplications({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    programId: programId ? Number(programId) : undefined,
    status: status ?? undefined,
    outcome: outcome ?? undefined,
    letterStatus: letterStatus ?? undefined,
    assessmentStatus: assessmentStatus ?? undefined,
    officerId: officerId ? Number(officerId) : undefined,
    intakeTerm,
    intakeYear: intakeYear ? Number(intakeYear) : undefined,
    submittedFrom: toApiDate(submitted[0]) ?? undefined,
    // A single picked day counts as that whole day.
    submittedTo: toApiDate(submitted[1] ?? submitted[0]) ?? undefined,
  });

  const moreCount = [assessmentStatus, letterStatus, officerId, intake, submitted[0]].filter(Boolean).length;
  const hasFilters = Boolean(debouncedSearch || programId || status || outcome || moreCount);

  // Every filter change starts again from page 1.
  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const clearMore = () => {
    setAssessmentStatus(null);
    setLetterStatus(null);
    setOfficerId(null);
    setIntake(null);
    setSubmitted([null, null]);
    setPage(1);
  };

  const label = <T extends string>(list: { value: T; label: string }[] | undefined, value: T | null) =>
    value ? (list?.find((item) => item.value === value)?.label ?? value) : null;

  const startAssessment = (application: IApplication) =>
    runAssessment.mutate(application.id, {
      onSuccess: () =>
        notifications.show({
          color: "green",
          title: "Assessment started",
          message: `${application.applicationNumber}: the result shows on the application in about a minute.`,
        }),
      // e.g. no OpenAI key yet: "Add your institution's OpenAI API key in Settings first"
      onError: (error) =>
        errorHandler(error, `Could not start the assessment of ${application.applicationNumber}`),
    });

  // A submitted application's actions, as on its page. Every one the role may use is listed; one the
  // API would refuse right now (409) is greyed, with why.
  const rowMenu = (application: IApplication) => {
    const { letter } = application;
    const running = application.status === "processing" || application.assessmentStatus === "in_progress";
    const actions: (IRowAction | false)[] = [
      can("applications", "create") && {
        label: "Run Assessment",
        icon: IconPlayerPlay,
        onClick: () => startAssessment(application),
        disabledReason: running
          ? "An assessment is already running"
          : application.status === "manual_review"
            ? "In manual review: return it for reassessment"
            : undefined,
      },
      can("letters", "create") &&
        can("applications", "create") && {
          label: letter ? "Generate Again" : "Generate Letter",
          icon: IconFileText,
          onClick: () => generateLetter.start(application, letter),
          disabledReason: canHaveLetter(application) ? undefined : "Once the application is decided",
        },
      can("communications", "create") && {
        label: "Send Email",
        icon: IconSend,
        onClick: () => letter && setSendingLetterId(letter.id),
        disabledReason: !letter
          ? "Generate the letter first"
          : letter.status === "rejected"
            ? "The letter was rejected: generate it again"
            : letter.status !== "approved"
              ? "Approve the letter first"
              : undefined,
      },
      can("letters", "read") && {
        label: "Download PDF",
        icon: IconDownload,
        onClick: () => letter && openLetterPdf(letter),
        disabledReason: letter ? undefined : "Generate the letter first",
      },
    ];
    return actions.filter((action): action is IRowAction => Boolean(action));
  };

  const confirmDelete = (application: IApplication) =>
    confirmDanger({
      title: "Delete draft",
      message: (
        <>
          Delete the draft <b>{application.applicationNumber}</b> for {application.student.fullName}?
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteDraft.mutate(application.id, {
          onSuccess: () =>
            notifications.show({
              color: "green",
              title: "Draft deleted",
              message: application.applicationNumber,
            }),
          onError: (err) => errorHandler(err, "Could not delete the draft"),
        }),
    });

  return (
    <Page>
      <PageHeader
        title="Applications"
        description="Every student application, newest first."
        action={
          can("applications", "create") && (
            <Button component={Link} to={RO_NEW_APPLICATION} leftSection={<IconPlus size={16} />}>
              New Application
            </Button>
          )
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="md" gap="sm">
          <TextInput
            placeholder="Search by app #, student or email"
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => withPageReset(setSearch)(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <SearchableSelect
            placeholder="All programs"
            searchPlaceholder="Search programs..."
            data={toSelectData(programs.data)}
            value={programId}
            onChange={withPageReset(setProgramId)}
            clearable
            w={{ base: "100%", sm: 190 }}
          />
          <Select
            placeholder="All statuses"
            data={options.data?.statuses ?? []}
            value={status}
            onChange={(value) => withPageReset(setStatus)(value as TApplicationStatus | null)}
            clearable
            w={{ base: "100%", sm: 160 }}
          />
          <Select
            placeholder="All outcomes"
            data={options.data?.outcomes ?? []}
            value={outcome}
            onChange={(value) => withPageReset(setOutcome)(value as TOutcome | null)}
            clearable
            w={{ base: "100%", sm: 170 }}
          />
          <Popover width={300} position="bottom-end" shadow="md" radius="md">
            <Popover.Target>
              <Indicator label={moreCount} size={16} disabled={!moreCount}>
                <Button variant="secondary" leftSection={<IconAdjustmentsHorizontal size={16} />}>
                  More Filters
                </Button>
              </Indicator>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="sm">
                <Select
                  label="Assessment"
                  placeholder="Any assessment"
                  data={options.data?.assessmentStatuses ?? []}
                  value={assessmentStatus}
                  onChange={(value) => withPageReset(setAssessmentStatus)(value as TAssessmentStatus | null)}
                  clearable
                  comboboxProps={{ withinPortal: false }}
                />
                {can("letters", "read") && (
                  <Select
                    label="Letter"
                    placeholder="Any letter"
                    data={LETTER_FILTERS}
                    value={letterStatus}
                    onChange={(value) => withPageReset(setLetterStatus)(value as TLetterFilter | null)}
                    clearable
                    comboboxProps={{ withinPortal: false }}
                  />
                )}
                <Select
                  label="Officer"
                  placeholder="Any officer"
                  data={(options.data?.officers ?? []).map(({ id, name }) => ({
                    value: String(id),
                    label: name,
                  }))}
                  value={officerId}
                  onChange={withPageReset(setOfficerId)}
                  clearable
                  comboboxProps={{ withinPortal: false }}
                />
                <Select
                  label="Intake"
                  placeholder="Any intake"
                  data={(options.data?.intakes ?? []).map(({ term, year, label: text }) => ({
                    value: `${term}-${year}`,
                    label: text,
                  }))}
                  value={intake}
                  onChange={withPageReset(setIntake)}
                  clearable
                  comboboxProps={{ withinPortal: false }}
                />
                <DatePickerInput
                  type="range"
                  allowSingleDateInRange
                  label="Submitted"
                  placeholder="Any date"
                  valueFormat="DD MMM YYYY"
                  leftSection={<IconCalendar size={16} />}
                  value={submitted}
                  onChange={withPageReset(setSubmitted)}
                  maxDate={new Date()}
                  clearable
                  popoverProps={{ withinPortal: false }}
                />
                <Group justify="flex-end">
                  <Button variant="tertiary" size="xs" onClick={clearMore} disabled={!moreCount}>
                    Clear
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load applications"
          isEmpty={!data?.items.length}
          emptyIcon={IconFileText}
          emptyTitle={hasFilters ? "No applications match your filters" : "No applications yet"}
          emptyText={hasFilters ? undefined : "Add the first one with New Application."}
        >
          {/* Things read together share a column: student + app #, status + assessment, outcome + confidence.
              The email is on the detail page (and search finds it). */}
          <Table.ScrollContainer minWidth={1000}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Student</Table.Th>
                  <Table.Th>Program</Table.Th>
                  <Table.Th>Submitted</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Outcome</Table.Th>
                  <Table.Th>Officer</Table.Th>
                  <Table.Th w={80} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.items.map((application, index) => {
                  const isDraft = application.status === "draft";
                  return (
                    <Table.Tr
                      key={application.id}
                      {...rowClick(() => navigate(applicationPath(application.id)))}
                    >
                      <SerialCell index={index} offset={(data.page - 1) * data.limit} />
                      <Table.Td>
                        <PersonCell
                          name={application.student.fullName}
                          subtitle={
                            <Text span ff="monospace" inherit>
                              {application.applicationNumber}
                            </Text>
                          }
                        />
                      </Table.Td>
                      <Table.Td maw={260}>
                        <Tooltip label={application.program.name} openDelay={400}>
                          <Text size="sm" truncate>
                            {application.program.name}
                          </Text>
                        </Tooltip>
                        <Text size="xs" c="dimmed">
                          {application.intake} · {studyModeLabels[application.studyMode]}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        {application.submittedAt ? (
                          <>
                            <Text size="sm">{formatDate(application.submittedAt)}</Text>
                            <Text size="xs" c="dimmed">
                              {dayjs(application.submittedAt).format("h:mm A")}
                            </Text>
                          </>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Not submitted
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={applicationStatusColors[application.status]}>
                          {label(options.data?.statuses, application.status)}
                        </Badge>
                        {application.assessmentStatus && (
                          <Group gap={4} mt={4} wrap="nowrap">
                            <StatusDot color={assessmentStatusColors[application.assessmentStatus]} />
                            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                              Assessment{" "}
                              {label(
                                options.data?.assessmentStatuses,
                                application.assessmentStatus
                              )?.toLowerCase()}
                            </Text>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {application.outcome ? (
                          <>
                            <Badge variant="light" color={outcomeColors[application.outcome]}>
                              {label(options.data?.outcomes, application.outcome)}
                            </Badge>
                            {application.confidence !== null && (
                              <Text size="xs" c="dimmed" mt={4}>
                                {Math.round(application.confidence * 100)}% confidence
                              </Text>
                            )}
                            {application.letter && (
                              <Group gap={6} mt={4} wrap="nowrap">
                                <StatusDot color={letterStatusColors[application.letter.status]} />
                                <Text size="xs" c="dimmed">
                                  Letter:{" "}
                                  {LETTER_FILTERS.find(({ value }) => value === application.letter?.status)
                                    ?.label ?? application.letter.status}
                                  {application.letter.emailStatus === "sent"
                                    ? " · Emailed"
                                    : application.letter.emailStatus === "failed"
                                      ? " · Email failed"
                                      : ""}
                                </Text>
                              </Group>
                            )}
                          </>
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        {application.officer ? (
                          <Text size="sm">{application.officer.name}</Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Unassigned
                          </Text>
                        )}
                      </Table.Td>
                      {/* A draft can be edited or deleted; a submitted one has its actions in the menu. */}
                      <Table.Td>
                        {isDraft ? (
                          <RowActions
                            name={application.applicationNumber}
                            onEdit={
                              can("applications", "update")
                                ? () => navigate(editApplicationPath(application.id))
                                : undefined
                            }
                            onDelete={
                              can("applications", "delete") ? () => confirmDelete(application) : undefined
                            }
                          />
                        ) : (
                          <RowActions name={application.applicationNumber} menu={rowMenu(application)} />
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>

        <ListFooter data={data} page={page} onChange={setPage} />
      </Card>
      <SendEmailForm letter={sendingLetter.data ?? null} onClose={() => setSendingLetterId(null)} />
    </Page>
  );
}
