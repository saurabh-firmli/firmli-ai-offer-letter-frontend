import { useState } from "react";
import {
  Anchor,
  Button,
  Card,
  Collapse,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  Timeline,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconFile,
  IconMessage,
  IconPencil,
  IconPlus,
  IconRobot,
  IconTrash,
  IconUserCheck,
} from "@tabler/icons-react";
import { IActivityItem, useApplicationActivity } from "../lib/applications";
import { IChange, fieldLabel, formatChangeValue } from "../lib/auditLogs";
import { formatDateTime, formatRelative } from "../lib/utils";

const PAGE = 10;
const MAX = 100; // the API sends at most 100 at once

// Same in every entry, so not worth a line.
const HIDDEN = ["tenantId"];

/** An icon per kind of event, so the timeline reads at a glance. */
function eventIcon({ entityType, action }: IActivityItem) {
  if (entityType.startsWith("assessment"))
    return entityType === "assessmentCriterion" ? IconUserCheck : IconRobot;
  if (entityType === "applicationDocument") return IconFile;
  if (entityType === "applicationNote") return IconMessage;
  if (entityType === "manualReview" || entityType === "applicationDocumentRequest") return IconUserCheck;
  if (action === "create") return IconPlus;
  if (action === "delete") return IconTrash;
  return IconPencil;
}

/** The changes of one event, as "Field: from → to" rows (a run's details are plain values). */
function EventDetails({ details }: { details: Record<string, unknown> }) {
  const rows = Object.entries(details).filter(([field, value]) => !HIDDEN.includes(field) && value !== null);
  if (!rows.length) return null;
  return (
    <Table mt={6} verticalSpacing={4} horizontalSpacing="sm" fz="xs" withTableBorder>
      <Table.Tbody>
        {rows.map(([field, value]) => {
          const change = value && typeof value === "object" && "to" in value ? (value as IChange) : null;
          return (
            <Table.Tr key={field}>
              <Table.Td c="dimmed" w="35%">
                {fieldLabel(field)}
              </Table.Td>
              <Table.Td>
                {change ? (
                  <>
                    {change.from !== null && change.from !== undefined && (
                      <Text span c="dimmed" td="line-through" inherit>
                        {formatChangeValue(change.from, field, change.fromName)}
                      </Text>
                    )}
                    {change.from !== null && change.from !== undefined && " → "}
                    <Text span fw={500} inherit>
                      {formatChangeValue(change.to, field, change.toName)}
                    </Text>
                  </>
                ) : (
                  formatChangeValue(
                    field === "confidence" && typeof value === "number"
                      ? `${Math.round(value * 100)}%`
                      : value,
                    field
                  )
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

function ActivityEvent({ item }: { item: IActivityItem }) {
  const [open, setOpen] = useState(false);
  const hasDetails = item.details && Object.keys(item.details).some((field) => !HIDDEN.includes(field));
  return (
    <div>
      <Text size="sm" fw={500}>
        {item.title}
      </Text>
      <Group gap={6}>
        <Text size="xs" c="dimmed">
          {item.user?.name ?? "System"} ·{" "}
          <Tooltip label={formatDateTime(item.at)}>
            <Text span inherit>
              {formatRelative(item.at)}
            </Text>
          </Tooltip>
        </Text>
        {hasDetails && (
          <Anchor component="button" type="button" size="xs" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide changes" : "Show changes"}
          </Anchor>
        )}
      </Group>
      {hasDetails && (
        <Collapse in={open}>
          <EventDetails details={item.details!} />
        </Collapse>
      )}
    </div>
  );
}

/** The whole history of the application, newest first; everyone who can read it sees all of it. */
export default function ApplicationActivity({ applicationId }: { applicationId: number }) {
  const [limit, setLimit] = useState(PAGE);
  const activity = useApplicationActivity(applicationId, limit);
  const items = activity.data?.items ?? [];
  const total = activity.data?.total ?? 0;

  return (
    <Card withBorder radius="lg" shadow="xs" padding="lg">
      <Title order={3} fz={16} mb="md">
        Activity{total ? ` (${total})` : ""}
      </Title>
      {activity.isLoading ? (
        <Stack gap="md">
          {[1, 2, 3].map((key) => (
            <Group key={key} gap="sm" wrap="nowrap">
              <Skeleton h={24} w={24} circle />
              <Stack gap={4} style={{ flex: 1 }}>
                <Skeleton h={12} w="60%" />
                <Skeleton h={10} w="30%" />
              </Stack>
            </Group>
          ))}
        </Stack>
      ) : items.length ? (
        <>
          {limit >= MAX && total > MAX && (
            <Text size="xs" c="dimmed" mb="sm">
              The latest {MAX} of {total} events.
            </Text>
          )}
          <Timeline bulletSize={24} lineWidth={2}>
            {items.map((item) => {
              const Icon = eventIcon(item);
              return (
                <Timeline.Item
                  key={item.id}
                  bullet={<Icon size={13} />}
                  color={
                    item.title.startsWith("Assessment failed")
                      ? "red"
                      : item.entityType === "manualReview"
                        ? "violet"
                        : "primary"
                  }
                >
                  <ActivityEvent item={item} />
                </Timeline.Item>
              );
            })}
          </Timeline>
          {items.length < total && limit < MAX && (
            <Button
              variant="subtle"
              size="xs"
              mt="md"
              onClick={() => setLimit((value) => Math.min(value + PAGE, MAX))}
              loading={activity.isFetching}
            >
              Show more ({total - items.length} older)
            </Button>
          )}
        </>
      ) : (
        <Group gap="xs">
          <IconCircleCheck size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">
            Nothing has happened yet.
          </Text>
        </Group>
      )}
    </Card>
  );
}
