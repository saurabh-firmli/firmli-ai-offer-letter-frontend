import {
  ActionIcon,
  Badge,
  CopyButton,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import FormModal from "../components/FormModal";
import {
  IAuditLog,
  auditActionColors,
  auditActionLabels,
  entityTypeLabel,
  fieldLabel,
  formatChangeValue,
  visibleChanges,
} from "../lib/auditLogs";
import { formatDateTime } from "../lib/utils";

interface IAuditLogDetailProps {
  opened: boolean;
  log: IAuditLog | null;
  onClose: () => void;
}

/** A logged value; long text (a template body) scrolls inside its cell. */
function Value({ value, field, name }: { value: unknown; field: string; name?: string | null }) {
  const text = formatChangeValue(value, field, name);
  return (
    <ScrollArea.Autosize mah={160}>
      <Text
        size="sm"
        c={text === "—" ? "dimmed" : undefined}
        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      >
        {text}
      </Text>
    </ScrollArea.Autosize>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" component="div">
        {children}
      </Text>
    </Stack>
  );
}

/** One audit log entry: who, when, and every changed field (before and after). */
export default function AuditLogDetail({ opened, log, onClose }: IAuditLogDetailProps) {
  const changes = log ? visibleChanges(log) : [];

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={log ? `${auditActionLabels[log.action]} ${entityTypeLabel(log.entityType)}` : ""}
      description={log?.entityLabel ?? (log ? `#${log.entityId}` : undefined)}
      size={720}
    >
      {log && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
            <Meta label="When">{formatDateTime(log.createdAt)}</Meta>
            <Meta label="By">{log.userName ?? "System"}</Meta>
            <Meta label="Action">
              <Badge variant="light" color={auditActionColors[log.action]}>
                {auditActionLabels[log.action]}
              </Badge>
            </Meta>
            {/* Logs of one click share it; also the id to search the backend logs by. */}
            <Meta label="Request ID">
              {log.requestId ? (
                <Group gap={4} wrap="nowrap">
                  <Text size="sm" ff="monospace" truncate>
                    {log.requestId}
                  </Text>
                  <CopyButton value={log.requestId}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Copied" : "Copy"}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          onClick={copy}
                          aria-label="Copy request ID"
                        >
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              ) : (
                "—"
              )}
            </Meta>
          </SimpleGrid>

          {changes.length ? (
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing="sm" horizontalSpacing="sm" withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={170}>Field</Table.Th>
                    {/* A create has only new values, a delete only the old ones. */}
                    {log.action !== "create" && (
                      <Table.Th>{log.action === "delete" ? "Value" : "Before"}</Table.Th>
                    )}
                    {log.action !== "delete" && (
                      <Table.Th>{log.action === "create" ? "Value" : "After"}</Table.Th>
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {changes.map(([field, { from, to, fromName, toName }]) => (
                    <Table.Tr key={field}>
                      <Table.Td fw={600} style={{ verticalAlign: "top" }}>
                        {fieldLabel(field)}
                      </Table.Td>
                      {log.action !== "create" && (
                        <Table.Td style={{ verticalAlign: "top" }}>
                          <Value value={from} field={field} name={fromName} />
                        </Table.Td>
                      )}
                      {log.action !== "delete" && (
                        <Table.Td style={{ verticalAlign: "top" }}>
                          <Value value={to} field={field} name={toName} />
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <Text size="sm" c="dimmed">
              No field changes were recorded.
            </Text>
          )}
        </Stack>
      )}
    </FormModal>
  );
}
