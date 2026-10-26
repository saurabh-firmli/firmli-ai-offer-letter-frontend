import { useState } from "react";
import {
  ActionIcon,
  Avatar,
  Badge,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DatePickerInput, DatesRangeValue } from "@mantine/dates";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { IconCalendar, IconEye, IconHistory, IconSearch, IconSettings } from "@tabler/icons-react";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import DataState from "../components/DataState";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { DateCell } from "../components/TableCells";
import PageHeader from "../components/PageHeader";
import { getInitials, useMe } from "../lib/auth";
import {
  IAuditLog,
  TAuditAction,
  TChange,
  auditActionColors,
  auditActionLabels,
  describeChange,
  entityTypeLabel,
  useAuditLogOptions,
  useAuditLogs,
  visibleChanges,
} from "../lib/auditLogs";

import AuditLogDetail from "./AuditLogDetail";
import { NO_AUTOFILL } from "../lib/forms";
import { toApiDate } from "../lib/utils";

const PAGE_SIZE = 20;

// Updates show this many changes in the table; the rest are one click away.
const SHOWN_CHANGES = 2;

/** One change in words: "Status: Draft → Active", "Award Level set to Certificate", "Description cleared". */
function ChangeLine({ change }: { change: TChange }) {
  const label = (
    <Text span c="dimmed" inherit>
      {change.label}
    </Text>
  );
  return (
    <Text size="sm" truncate>
      {change.kind === "password" && <>Password reset</>}
      {change.kind === "secret" && (
        <>
          {label} {change.what}
        </>
      )}
      {change.kind === "set" && (
        <>
          {label} set to <b>{change.to}</b>
        </>
      )}
      {change.kind === "cleared" && <>{label} cleared</>}
      {change.kind === "changed" && (
        <>
          {label}:{" "}
          <Text span c="dimmed" td="line-through" inherit>
            {change.from}
          </Text>{" "}
          → <b>{change.to}</b>
        </>
      )}
    </Text>
  );
}

/** The table's summary of a log: an update's first changes, or what was added / removed. */
function ChangesSummary({ log }: { log: IAuditLog }) {
  const type = entityTypeLabel(log.entityType);
  if (log.action !== "update")
    return (
      <Text size="sm" c="dimmed">
        {log.action === "create" ? `New ${type.toLowerCase()} added` : `${type} removed`}
      </Text>
    );
  const changes = visibleChanges(log);
  if (!changes.length)
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  const more = changes.length - SHOWN_CHANGES;
  return (
    <Stack gap={2} miw={0}>
      {changes.slice(0, SHOWN_CHANGES).map(([field, change]) => (
        <ChangeLine key={field} change={describeChange(field, change)} />
      ))}
      {more > 0 && (
        <Text size="xs" c="primary">
          +{more} more {more === 1 ? "change" : "changes"}
        </Text>
      )}
    </Stack>
  );
}

export default function AuditLogs() {
  const { data: me } = useMe();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [module, setModule] = useState<string | null>(null);
  const [action, setAction] = useState<TAuditAction | null>(null);
  const [dates, setDates] = useState<DatesRangeValue>([null, null]);
  // The modal keeps the last log while it animates closed.
  const [viewing, setViewing] = useState<IAuditLog | null>(null);
  const [detailOpened, detail] = useDisclosure();
  const openDetail = (log: IAuditLog) => {
    setViewing(log);
    detail.open();
  };

  const options = useAuditLogOptions();
  const { data, isLoading, error } = useAuditLogs({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    module: module ?? undefined,
    action: action ?? undefined,
    from: toApiDate(dates[0]) ?? undefined,
    // A single picked day counts as that whole day.
    to: toApiDate(dates[1] ?? dates[0]) ?? undefined,
  });

  const hasFilters = Boolean(debouncedSearch || module || action || dates[0]);

  // Every filter change starts again from page 1.
  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  // The API decides who sees what: the Super Admin every change, everyone else their own.
  const seesAll = me?.role === "super_admin";

  return (
    <Page>
      <PageHeader
        title="Audit Log"
        description={
          seesAll
            ? `Every change made at ${me?.tenant?.name ?? "your company"}, newest first.`
            : "The changes you made, newest first. Only a Super Admin sees everyone's."
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="md" gap="sm">
          <TextInput
            placeholder={seesAll ? "Search by record or user" : "Search by record"}
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => withPageReset(setSearch)(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select
            placeholder="All modules"
            data={(options.data?.modules ?? []).map(({ code, name }) => ({ value: code, label: name }))}
            value={module}
            onChange={withPageReset(setModule)}
            clearable
            w={{ base: "100%", sm: 180 }}
          />
          <Select
            placeholder="All actions"
            data={options.data?.actions ?? []}
            value={action}
            onChange={(value) => withPageReset(setAction)(value as TAuditAction | null)}
            clearable
            w={{ base: "100%", sm: 150 }}
          />
          <DatePickerInput
            type="range"
            allowSingleDateInRange
            placeholder="Any date"
            valueFormat="DD MMM YYYY"
            leftSection={<IconCalendar size={16} />}
            value={dates}
            onChange={withPageReset(setDates)}
            maxDate={new Date()}
            clearable
            w={{ base: "100%", sm: 260 }}
          />
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load the audit log"
          isEmpty={!data?.items.length}
          emptyIcon={IconHistory}
          emptyTitle={hasFilters ? "No changes match your filters" : "No changes yet"}
          emptyText={hasFilters ? undefined : "Every create, update and delete shows up here."}
        >
          <Table.ScrollContainer minWidth={960}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th w={190}>When</Table.Th>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Action</Table.Th>
                  <Table.Th>Record</Table.Th>
                  <Table.Th w="34%">Changes</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.items.map((log, index) => (
                  <Table.Tr key={log.id} style={{ cursor: "pointer" }} onClick={() => openDetail(log)}>
                    <SerialCell index={index} offset={(data.page - 1) * data.limit} />
                    <Table.Td>
                      <DateCell value={log.createdAt} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        {log.userName ? (
                          <Avatar radius="xl" size="sm" color="primary" variant="light">
                            {getInitials(log.userName)}
                          </Avatar>
                        ) : (
                          <Avatar radius="xl" size="sm" color="gray" variant="light">
                            <IconSettings size={14} />
                          </Avatar>
                        )}
                        <Text size="sm" fw={500} style={{ whiteSpace: "nowrap" }}>
                          {log.userName ?? "System"}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={auditActionColors[log.action]}>
                        {auditActionLabels[log.action]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} size="sm" lineClamp={1}>
                        {log.entityLabel ?? `#${log.entityId}`}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {entityTypeLabel(log.entityType)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ChangesSummary log={log} />
                    </Table.Td>
                    <Table.Td>
                      <Group justify="flex-end">
                        <Tooltip label="View changes">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`View changes to ${log.entityLabel ?? log.entityType}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetail(log);
                            }}
                          >
                            <IconEye size={18} />
                          </ActionIcon>
                        </Tooltip>
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

      <AuditLogDetail opened={detailOpened} log={viewing} onClose={detail.close} />
    </Page>
  );
}
