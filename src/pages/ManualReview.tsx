import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconClipboardCheck,
  IconClock,
  IconFileUpload,
  IconGavel,
  IconNote,
  IconRefresh,
  IconSearch,
  IconUserPlus,
} from "@tabler/icons-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import DataState from "../components/DataState";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import SearchableSelect from "../components/SearchableSelect";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { PersonCell } from "../components/TableCells";
import { useCan } from "../lib/auth";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import {
  IReview,
  TReviewPriority,
  TReviewStatus,
  formatQueueTime,
  priorityColors,
  reviewStatusColors,
  useReviewOptions,
  useReviews,
} from "../lib/reviews";
import { formatDateTime } from "../lib/utils";
import { applicationPath } from "../routes";

import {
  AddReviewNoteForm,
  AssignReviewerForm,
  RequestDocumentsForm,
  ReturnForReassessmentForm,
} from "./ManualReviewDialogs";
import ReviewDrawer from "./ReviewDrawer";
import { NO_AUTOFILL } from "../lib/forms";

const PAGE_SIZE = 20;
const STATUS_ORDER: TReviewStatus[] = [
  "unassigned",
  "assigned",
  "in_review",
  "waiting_documents",
  "resolved",
];

// The AI's confidence: below half is weak, 80% and up is strong.
const confidenceColor = (confidence: number) =>
  confidence >= 0.8 ? "green" : confidence >= 0.5 ? "orange" : "red";

/**
 * Applications the AI couldn't decide alone, as review cases. The API orders them for work: open
 * cases first, highest priority first, then the longest waiting.
 */
export default function ManualReview() {
  const can = useCan();
  const navigate = useNavigate();
  const canAct = can("reviews", "update");
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<TReviewStatus | "all">(
    (STATUS_ORDER.find((value) => value === searchParams.get("status")) as TReviewStatus | undefined) ?? "all"
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? ""); // ?search= from an application
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [programId, setProgramId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TReviewPriority | null>(null);
  const [reviewer, setReviewer] = useState<string | null>(searchParams.get("mine") ? "mine" : null); // "mine" or a user id
  const [assigning, setAssigning] = useState<IReview | null>(null);
  const [requesting, setRequesting] = useState<IReview | null>(null);
  const [returning, setReturning] = useState<IReview | null>(null);
  const [noting, setNoting] = useState<IReview | null>(null);
  const [reviewing, setReviewing] = useState<IReview | null>(null); // the case open in the Review drawer
  // Opened again from the bell while already here: take the new filter. The location key changes on
  // every navigation, so the same bell item clicked again after changing the filters applies it too.
  const urlFilter = searchParams.toString();
  const { key: locationKey } = useLocation();
  useEffect(() => {
    if (!urlFilter) return;
    setStatus(
      (STATUS_ORDER.find((value) => value === searchParams.get("status")) as TReviewStatus | undefined) ??
        "all"
    );
    setReviewer(searchParams.get("mine") ? "mine" : null);
    setSearch(searchParams.get("search") ?? "");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter, locationKey]);

  const options = useReviewOptions();
  const programs = useDropdown("programs");
  const { data, isLoading, error } = useReviews({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    search: debouncedSearch || undefined,
    programId: programId ? Number(programId) : undefined,
    priority: priority ?? undefined,
    mine: reviewer === "mine" || undefined,
    reviewerId: reviewer && reviewer !== "mine" ? Number(reviewer) : undefined,
  });

  const counts = data?.counts;
  const open = counts ? counts.unassigned + counts.assigned + counts.in_review : 0;
  const hasFilters = Boolean(debouncedSearch || programId || priority || reviewer || status !== "all");
  const statusLabel = (value: TReviewStatus) =>
    options.data?.statuses.find((item) => item.value === value)?.label;
  const resolutionLabel = (value: string | null) =>
    options.data?.resolutions?.find((item) => item.value === value)?.label ?? "Resolved";
  const priorityLabel = (value: TReviewPriority) =>
    options.data?.priorities.find((item) => item.value === value)?.label ?? value;

  // Every filter change starts again from page 1.
  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <Page>
      <PageHeader
        title="Manual Review Queue"
        description={
          counts
            ? open
              ? `${open} open ${open === 1 ? "case needs" : "cases need"} a person. Most urgent first.`
              : "Nothing is waiting. All clear."
            : "Applications the AI couldn't decide alone, for a person to review."
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Stack gap="sm" p="md">
          {/* Status with its count; the counts follow the other filters. Scrolls sideways on a phone. */}
          <ScrollArea type="never">
            <SegmentedControl
              value={status}
              onChange={(value) => withPageReset(setStatus)(value as TReviewStatus | "all")}
              data={[
                {
                  value: "all",
                  label: counts ? `All · ${STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0)}` : "All",
                },
                ...STATUS_ORDER.map((value) => ({
                  value,
                  label: `${statusLabel(value) ?? value}${counts ? ` · ${counts[value]}` : ""}`,
                })),
              ]}
            />
          </ScrollArea>
          <Group gap="sm">
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
              w={{ base: "100%", sm: 200 }}
            />
            <Select
              placeholder="All priorities"
              data={options.data?.priorities ?? []}
              value={priority}
              onChange={(value) => withPageReset(setPriority)(value as TReviewPriority | null)}
              clearable
              w={{ base: "100%", sm: 160 }}
            />
            <Select
              placeholder="All reviewers"
              data={[
                { value: "mine", label: "My reviews" },
                ...(options.data?.reviewers ?? []).map(({ id, name }) => ({
                  value: String(id),
                  label: name,
                })),
              ]}
              value={reviewer}
              onChange={withPageReset(setReviewer)}
              clearable
              w={{ base: "100%", sm: 180 }}
            />
          </Group>
        </Stack>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load the queue"
          isEmpty={!data?.items.length}
          emptyIcon={IconClipboardCheck}
          emptyTitle={hasFilters ? "No cases match your filters" : "Nothing to review"}
          emptyText={hasFilters ? undefined : "Applications the AI can't decide alone show up here."}
        >
          {/* Like Applications: things read together share a column (status + reviewer, reason + missing). */}
          <Table.ScrollContainer minWidth={1080}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Application</Table.Th>
                  <Table.Th>Reason</Table.Th>
                  <Table.Th>Confidence</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Queue Time</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.items.map((review, index) => {
                  const resolved = review.status === "resolved";
                  return (
                    <Table.Tr
                      key={review.id}
                      {...rowClick(() => navigate(applicationPath(review.application.id)))}
                    >
                      <SerialCell index={index} offset={(data.page - 1) * data.limit} />
                      <Table.Td maw={260}>
                        <PersonCell
                          name={review.student.name}
                          subtitle={
                            <Text span ff="monospace" inherit>
                              {review.application.applicationNumber}
                            </Text>
                          }
                          more={
                            <Tooltip label={review.program.name} openDelay={400}>
                              <Text size="xs" c="dimmed" truncate>
                                {review.program.name}
                              </Text>
                            </Tooltip>
                          }
                        />
                      </Table.Td>
                      <Table.Td miw={220} maw={320}>
                        <Tooltip label={review.reason} disabled={!review.reason} multiline maw={320}>
                          <Text size="sm" lineClamp={2} c={review.reason ? undefined : "dimmed"}>
                            {review.reason ?? "—"}
                          </Text>
                        </Tooltip>
                        {(review.flags.length > 0 || review.missingDocuments > 0) && (
                          <Group gap={4} mt={6}>
                            {review.missingDocuments > 0 && (
                              <Badge size="xs" variant="filled" color="red" radius="sm">
                                {review.missingDocuments} missing{" "}
                                {review.missingDocuments === 1 ? "document" : "documents"}
                              </Badge>
                            )}
                            {review.flags.map((flag) => (
                              <Badge key={flag.code} size="xs" variant="light" color="red" radius="sm">
                                {flag.label}
                              </Badge>
                            ))}
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {review.confidence === null ? (
                          <Text c="dimmed">—</Text>
                        ) : (
                          <Badge variant="light" color={confidenceColor(review.confidence)}>
                            {Math.round(review.confidence * 100)}%
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="dot" color={priorityColors[review.priority]}>
                          {priorityLabel(review.priority)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip
                          label={`In the queue since ${formatDateTime(review.queuedAt)}${resolved ? " (stopped when resolved)" : ""}`}
                        >
                          {/* One line: "42d 10h" never splits under its clock. */}
                          <Group gap={6} wrap="nowrap" w="max-content">
                            <IconClock
                              size={14}
                              color="var(--mantine-color-dimmed)"
                              style={{ flexShrink: 0 }}
                            />
                            <Text size="sm" style={{ whiteSpace: "nowrap" }}>
                              {formatQueueTime(review.queueSeconds)}
                            </Text>
                          </Group>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <Badge variant="light" color={reviewStatusColors[review.status]}>
                          {statusLabel(review.status) ?? review.status}
                        </Badge>
                        {resolved ? (
                          <Tooltip label={review.resolutionNote ?? "No note"} multiline maw={300}>
                            <Text size="xs" c="dimmed" mt={4}>
                              {resolutionLabel(review.resolution)}
                              {review.resolvedBy ? ` · ${review.resolvedBy.name}` : ""}
                            </Text>
                          </Tooltip>
                        ) : (
                          review.reviewer && (
                            <Text size="xs" c="dimmed" mt={4}>
                              {review.reviewer.name}
                            </Text>
                          )
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="xs"
                            variant={resolved || !canAct ? "secondary" : "light"}
                            leftSection={<IconGavel size={14} />}
                            onClick={() => setReviewing(review)}
                          >
                            {resolved || !canAct ? "View" : "Review"}
                          </Button>
                          {canAct && (
                            <RowActions
                              name={review.application.applicationNumber}
                              extra={[
                                ...(resolved
                                  ? []
                                  : [
                                      {
                                        label: review.reviewer ? "Reassign Reviewer" : "Assign Reviewer",
                                        icon: IconUserPlus,
                                        onClick: () => setAssigning(review),
                                      },
                                    ]),
                                {
                                  label: "Add Review Note",
                                  icon: IconNote,
                                  color: "violet",
                                  onClick: () => setNoting(review),
                                },
                                ...(resolved
                                  ? []
                                  : [
                                      {
                                        label: "Request Documents",
                                        icon: IconFileUpload,
                                        color: "primary",
                                        onClick: () => setRequesting(review),
                                      },
                                      {
                                        label: "Return for Reassessment",
                                        icon: IconRefresh,
                                        color: "orange",
                                        onClick: () => setReturning(review),
                                      },
                                    ]),
                              ]}
                            />
                          )}
                        </Group>
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

      <AssignReviewerForm review={assigning} onClose={() => setAssigning(null)} />
      <RequestDocumentsForm review={requesting} onClose={() => setRequesting(null)} />
      <ReturnForReassessmentForm review={returning} onClose={() => setReturning(null)} />
      <AddReviewNoteForm review={noting} onClose={() => setNoting(null)} />
      <ReviewDrawer review={reviewing} onClose={() => setReviewing(null)} />
    </Page>
  );
}
