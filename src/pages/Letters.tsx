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
  IconCheck,
  IconDownload,
  IconEye,
  IconFileDescription,
  IconSearch,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";
import DataState from "../components/DataState";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import SearchableSelect from "../components/SearchableSelect";
import { DateCell, PersonCell } from "../components/TableCells";
import { SerialCell, SerialHead } from "../components/TableSerial";
import StatusDot from "../components/StatusDot";
import { useCan } from "../lib/auth";
import { emailSendStatusColors, useEmailStatusLabel } from "../lib/emails";
import { TLetterType } from "../lib/letterTemplates";
import {
  ILetter,
  LETTER_STATUS_ORDER,
  TLetterStatus,
  letterStatusColors,
  openLetterPdf,
  useLetters,
  useLetterStatusLabel,
  useLetterTypeLabel,
  useLetterTypeOptions,
} from "../lib/letters";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import { applicationPath } from "../routes";

import { SendEmailForm } from "./EmailView";
import LetterView, { LetterReviewForm } from "./LetterView";
import { NO_AUTOFILL } from "../lib/forms";

const PAGE_SIZE = 20;
// "current" = no status filter: the API lists the current letters, not the replaced ones.
type TStatusFilter = TLetterStatus | "current";

const statusFromUrl = (value: string | null) =>
  LETTER_STATUS_ORDER.find((status) => status === value) ?? "current";

/**
 * The letters generated for applications: the approvals page. Letters waiting for approval come
 * here (the bell opens it on Waiting for Approval); a person with Letters update approves or
 * rejects them. Everyone with Letters read can view and download the PDF.
 */
export default function Letters() {
  const can = useCan();
  const canReview = can("letters", "update");
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  // The status filter lives in the URL (?status=), so the bell can open this page on it.
  const status = statusFromUrl(searchParams.get("status"));
  const setStatus = (value: TStatusFilter) =>
    setSearchParams(value === "current" ? {} : { status: value }, { replace: true });
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [letterType, setLetterType] = useState<TLetterType | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const canSend = can("communications", "create");
  const [sending, setSending] = useState<ILetter | null>(null);
  const emailStatusLabel = useEmailStatusLabel();
  const [reviewing, setReviewing] = useState<{ letter: ILetter; action: "approve" | "reject" } | null>(null);
  // A new status (a chip, or the bell while already here) starts again from page 1.
  useEffect(() => setPage(1), [status]);

  const statusLabel = useLetterStatusLabel();
  const typeLabel = useLetterTypeLabel();
  const typeOptions = useLetterTypeOptions();
  const programs = useDropdown("programs");
  const { data, isLoading, error } = useLetters({
    page,
    limit: PAGE_SIZE,
    status: status === "current" ? undefined : status,
    letterType: letterType ?? undefined,
    programId: programId ? Number(programId) : undefined,
    search: debouncedSearch || undefined,
  });

  const counts = data?.counts;
  const waiting = counts?.pending_approval ?? 0;
  const hasFilters = Boolean(debouncedSearch || letterType || programId || status !== "current");

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
        title="Letters"
        description={
          counts
            ? waiting
              ? `${waiting} ${waiting === 1 ? "letter is" : "letters are"} waiting for approval.`
              : "No letter is waiting for approval."
            : "The letters generated for applications, and their approval."
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Stack gap="sm" p="md">
          {/* Status with its count; the counts follow the other filters. Scrolls sideways on a phone. */}
          <ScrollArea type="never">
            <SegmentedControl
              value={status}
              onChange={(value) => withPageReset(setStatus)(value as TStatusFilter)}
              data={[
                {
                  value: "current",
                  label: counts
                    ? `Current · ${counts.pending_approval + counts.approved + counts.rejected}`
                    : "Current",
                },
                ...LETTER_STATUS_ORDER.map((value) => ({
                  value,
                  label: `${statusLabel(value)}${counts ? ` · ${counts[value]}` : ""}`,
                })),
              ]}
            />
          </ScrollArea>
          <Group gap="sm">
            <TextInput
              placeholder="Search by reference, app # or student"
              {...NO_AUTOFILL}
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => withPageReset(setSearch)(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <Select
              placeholder="All letter types"
              data={typeOptions}
              value={letterType}
              onChange={(value) => withPageReset(setLetterType)(value as TLetterType | null)}
              clearable
              w={{ base: "100%", sm: 190 }}
            />
            <SearchableSelect
              placeholder="All programs"
              searchPlaceholder="Search programs..."
              data={toSelectData(programs.data)}
              value={programId}
              onChange={withPageReset(setProgramId)}
              clearable
              w={{ base: "100%", sm: 220 }}
            />
          </Group>
        </Stack>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load the letters"
          isEmpty={!data?.items.length}
          emptyIcon={IconFileDescription}
          emptyTitle={hasFilters ? "No letters match your filters" : "No letters yet"}
          emptyText={
            hasFilters ? undefined : "Generate Letter on a decided application, and its letter shows up here."
          }
        >
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Letter</Table.Th>
                  <Table.Th>Student</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Generated</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.items.map((letter, index) => {
                  const canDecide = canReview && letter.status === "pending_approval";
                  return (
                    <Table.Tr key={letter.id} {...rowClick(() => setViewing(letter.id))}>
                      <SerialCell index={index} offset={(data.page - 1) * data.limit} />
                      {/* The reference with its type; the subject on hover. */}
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <Tooltip
                          label={letter.subject}
                          disabled={!letter.subject}
                          openDelay={400}
                          multiline
                          maw={320}
                        >
                          <div>
                            <Text size="sm" fw={600} ff="monospace">
                              {letter.referenceNumber}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {typeLabel(letter.letterType)}
                            </Text>
                          </div>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td maw={280}>
                        <PersonCell
                          name={letter.student.name}
                          subtitle={
                            <Text
                              span
                              ff="monospace"
                              inherit
                              component={Link}
                              to={applicationPath(letter.application.id)}
                              onClick={(e) => e.stopPropagation()}
                              c="inherit"
                              td="underline"
                            >
                              {letter.application.applicationNumber}
                            </Text>
                          }
                          more={
                            <Text size="xs" c="dimmed" truncate>
                              {letter.program.name}
                            </Text>
                          }
                        />
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <Badge variant="light" color={letterStatusColors[letter.status]}>
                          {statusLabel(letter.status)}
                        </Badge>
                        {letter.email ? (
                          <Group gap={6} mt={4} wrap="nowrap">
                            <StatusDot color={emailSendStatusColors[letter.email.status]} />
                            <Text size="xs" c="dimmed">
                              Email: {emailStatusLabel(letter.email.status)}
                            </Text>
                          </Group>
                        ) : (
                          letter.reviewNote &&
                          letter.status !== "pending_approval" && (
                            <Tooltip label={letter.reviewNote} multiline maw={300}>
                              <Text size="xs" c="dimmed" mt={4}>
                                {letter.reviewedBy ? letter.reviewedBy.name : "Automatically"}
                              </Text>
                            </Tooltip>
                          )
                        )}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <DateCell value={letter.createdAt} />
                        {letter.generatedBy && (
                          <Text size="xs" c="dimmed">
                            by {letter.generatedBy.name}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="xs"
                            variant={canDecide ? "light" : "secondary"}
                            leftSection={<IconEye size={14} />}
                            onClick={() => setViewing(letter.id)}
                          >
                            {canDecide ? "Review" : "View"}
                          </Button>
                          <RowActions
                            name={letter.referenceNumber}
                            extra={[
                              {
                                label: "Download PDF",
                                icon: IconDownload,
                                onClick: () => openLetterPdf(letter),
                              },
                              ...(canSend && letter.status === "approved"
                                ? [
                                    {
                                      label: letter.email ? "Send Again" : "Send Email",
                                      icon: IconSend,
                                      onClick: () => setSending(letter),
                                    },
                                  ]
                                : []),
                              ...(canDecide
                                ? [
                                    {
                                      label: "Approve",
                                      icon: IconCheck,
                                      color: "green",
                                      onClick: () => setReviewing({ letter, action: "approve" as const }),
                                    },
                                    {
                                      label: "Reject",
                                      icon: IconX,
                                      color: "red",
                                      onClick: () => setReviewing({ letter, action: "reject" as const }),
                                    },
                                  ]
                                : []),
                            ]}
                          />
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

      <LetterView letterId={viewing} onClose={() => setViewing(null)} />
      <SendEmailForm letter={sending} onClose={() => setSending(null)} />
      <LetterReviewForm
        letter={reviewing?.letter ?? null}
        action={reviewing?.action ?? "approve"}
        onClose={() => setReviewing(null)}
      />
    </Page>
  );
}
