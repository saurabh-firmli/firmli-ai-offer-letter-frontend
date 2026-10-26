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
import { IconEye, IconMail, IconPaperclip, IconRefresh, IconSearch } from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";
import DataState from "../components/DataState";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import { DateCell } from "../components/TableCells";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { useCan } from "../lib/auth";
import { TEmailType } from "../lib/emailTemplates";
import {
  EMAIL_STATUS_ORDER,
  TEmailSendStatus,
  canRetryEmail,
  emailSendStatusColors,
  useEmails,
  useEmailStatusLabel,
  useEmailTypeLabel,
  useEmailTypeOptions,
} from "../lib/emails";
import { applicationPath } from "../routes";

import EmailView, { attemptsText, useRetry } from "./EmailView";
import { NO_AUTOFILL } from "../lib/forms";

const PAGE_SIZE = 20;
type TStatusFilter = TEmailSendStatus | "all";

const statusFromUrl = (value: string | null) =>
  EMAIL_STATUS_ORDER.find((status) => status === value) ?? "all";

/**
 * Communications: every email to a student, newest first, with its status and tries. Failed ones
 * are retried by themselves; Retry sends one again now (Communications update). The bell opens this
 * page on Failed.
 */
export default function Communications() {
  const can = useCan();
  const canRetry = can("communications", "update");
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  // The status filter lives in the URL (?status=), so the bell can open this page on it.
  const status = statusFromUrl(searchParams.get("status"));
  const setStatus = (value: TStatusFilter) =>
    setSearchParams(value === "all" ? {} : { status: value }, { replace: true });
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [emailType, setEmailType] = useState<TEmailType | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const retry = useRetry();
  // A new status (a chip, or the bell while already here) starts again from page 1.
  useEffect(() => setPage(1), [status]);

  const statusLabel = useEmailStatusLabel();
  const typeLabel = useEmailTypeLabel();
  const typeOptions = useEmailTypeOptions();
  const { data, isLoading, error } = useEmails({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    emailType: emailType ?? undefined,
    search: debouncedSearch || undefined,
  });

  const counts = data?.counts;
  const failed = counts?.failed ?? 0;
  const hasFilters = Boolean(debouncedSearch || emailType || status !== "all");

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
        title="Communications"
        description={
          counts
            ? failed
              ? `${failed} ${failed === 1 ? "email" : "emails"} to students failed. Retry once the cause is fixed.`
              : "Every email to a student, with its status. Failed ones are retried by themselves."
            : "Every email to a student, with its status."
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
                  value: "all",
                  label: counts
                    ? `All · ${EMAIL_STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0)}`
                    : "All",
                },
                ...EMAIL_STATUS_ORDER.map((value) => ({
                  value,
                  label: `${statusLabel(value)}${counts ? ` · ${counts[value]}` : ""}`,
                })),
              ]}
            />
          </ScrollArea>
          <Group gap="sm">
            <TextInput
              placeholder="Search by recipient, subject or app #"
              {...NO_AUTOFILL}
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => withPageReset(setSearch)(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <Select
              placeholder="All email types"
              data={typeOptions}
              value={emailType}
              onChange={(value) => withPageReset(setEmailType)(value as TEmailType | null)}
              clearable
              w={{ base: "100%", sm: 200 }}
            />
          </Group>
        </Stack>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load the emails"
          isEmpty={!data?.items.length}
          emptyIcon={IconMail}
          emptyTitle={hasFilters ? "No emails match your filters" : "No emails yet"}
          emptyText={
            hasFilters ? undefined : "Send Email on an approved letter, and the email shows up here."
          }
        >
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Email</Table.Th>
                  <Table.Th>To</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Sent</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.items.map((email, index) => (
                  <Table.Tr key={email.id} {...rowClick(() => setViewing(email.id))}>
                    <SerialCell index={index} offset={(data.page - 1) * data.limit} />
                    <Table.Td maw={340}>
                      <Text size="sm" fw={600} truncate>
                        {email.subject}
                      </Text>
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" c="dimmed" truncate>
                          {typeLabel(email.emailType)}
                          {email.letter ? ` · ${email.letter.referenceNumber}` : ""}
                        </Text>
                        {email.attachLetter && email.letter && (
                          <Tooltip label="The letter's PDF is attached">
                            <IconPaperclip
                              size={12}
                              color="var(--mantine-color-dimmed)"
                              style={{ flexShrink: 0 }}
                            />
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td maw={260}>
                      <Text size="sm" truncate>
                        {email.recipient}
                      </Text>
                      {email.application && (
                        <Text
                          size="xs"
                          ff="monospace"
                          c="dimmed"
                          td="underline"
                          component={Link}
                          to={applicationPath(email.application.id)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {email.application.applicationNumber}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Badge variant="light" color={emailSendStatusColors[email.status]}>
                        {statusLabel(email.status)}
                      </Badge>
                      <Tooltip label={email.lastError} disabled={!email.lastError} multiline maw={320}>
                        <Text
                          size="xs"
                          c={email.lastError && email.status !== "sent" ? "red" : "dimmed"}
                          mt={4}
                        >
                          {attemptsText(email)}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <DateCell value={email.sentAt ?? email.createdAt} />
                      <Text size="xs" c="dimmed">
                        {email.sentBy ? `by ${email.sentBy.name}` : "Automatically"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="xs"
                          variant="secondary"
                          leftSection={<IconEye size={14} />}
                          onClick={() => setViewing(email.id)}
                        >
                          View
                        </Button>
                        {canRetry && canRetryEmail(email.status) && (
                          <RowActions
                            name={email.subject}
                            extra={[
                              {
                                label: "Retry Now",
                                icon: IconRefresh,
                                color: "orange",
                                onClick: () => retry.run(email),
                              },
                            ]}
                          />
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>

        <ListFooter data={data} page={page} onChange={setPage} />
      </Card>

      <EmailView emailId={viewing} onClose={() => setViewing(null)} />
    </Page>
  );
}
