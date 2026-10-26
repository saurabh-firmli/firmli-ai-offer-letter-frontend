import { ReactNode } from "react";
import {
  Anchor,
  Avatar,
  Badge,
  Card,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowRight,
  IconChevronRight,
  IconFileAlert,
  IconFilePlus,
  IconFileUpload,
  IconInbox,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { applicationStatusColors, outcomeColors, useApplicationOptions } from "../lib/applications";
import { getInitials } from "../lib/auth";
import { IDashboard, TAttentionReason } from "../lib/dashboard";
import { formatDateTime, formatRelative, formatSince } from "../lib/utils";
import { applicationPath } from "../routes";
import TrendChart, { trendRange, trendUnit } from "../components/TrendChart";
import classes from "./Dashboard.module.css";

/* Dashboard widgets: each takes its part of GET /dashboard as props. */

// --- Shared ---

/** The frame of every dashboard widget: title, one line under it, and an optional "View all" link. */
export function WidgetCard({
  title,
  description,
  link,
  children,
  padded = true,
}: {
  title: string;
  description: string;
  link?: { label: string; to: string };
  children: ReactNode;
  padded?: boolean; // false when the rows run edge to edge
}) {
  return (
    <Card withBorder radius="lg" shadow="xs" padding={0} h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap" p="lg" pb={padded ? 0 : "md"}>
        <div>
          <Title order={3} fz={18}>
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </div>
        {link && (
          <Anchor component={Link} to={link.to} size="sm" fw={500} style={{ whiteSpace: "nowrap" }}>
            <Group gap={4} wrap="nowrap">
              {link.label}
              <IconArrowRight size={14} />
            </Group>
          </Anchor>
        )}
      </Group>
      <div style={padded ? { padding: "var(--mantine-spacing-lg)" } : undefined}>{children}</div>
    </Card>
  );
}

/** A widget with nothing to show yet. */
export function Empty({ icon: Icon = IconInbox, text }: { icon?: typeof IconInbox; text: string }) {
  return (
    <Stack align="center" gap={6} py="xl" px="lg">
      <Icon size={28} stroke={1.4} color="var(--mantine-color-gray-5)" />
      <Text size="sm" c="dimmed" ta="center">
        {text}
      </Text>
    </Stack>
  );
}

/** "5 minutes ago", with the exact time on hover. */
function Ago({ at }: { at: string }) {
  return (
    <Tooltip label={formatDateTime(at)}>
      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
        {formatRelative(at)}
      </Text>
    </Tooltip>
  );
}

export interface IKpiCardProps {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof IconInbox;
  color: string;
}

/** A headline number: icon and label, the value, one dimmed line under it. */
export function KpiCard({ label, value, hint, icon: Icon, color }: IKpiCardProps) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" className={classes.card}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={36} radius="md" variant="light" color={color}>
          <Icon size={20} stroke={1.8} />
        </ThemeIcon>
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
      </Group>
      <Text fz={32} fw={700} lh={1.1} mt="md">
        {value}
      </Text>
      <Text size="xs" c="dimmed" mt={6}>
        {hint}
      </Text>
    </Card>
  );
}

// --- Recent applications ---

export function RecentApplications({
  items,
  viewAllTo,
}: {
  items: IDashboard["recentApplications"];
  viewAllTo: string;
}) {
  const options = useApplicationOptions();
  return (
    <WidgetCard
      title="Recent Applications"
      description="The latest submitted"
      link={{ label: "View all", to: viewAllTo }}
      padded={false}
    >
      {!items.length && <Empty text="No submitted applications yet." />}
      {items.map((item) => {
        // The outcome once there is one, else where it stands.
        const badge = item.outcome
          ? {
              label: options.data?.outcomes.find(({ value }) => value === item.outcome)?.label,
              color: outcomeColors[item.outcome],
            }
          : {
              label: options.data?.statuses.find(({ value }) => value === item.status)?.label,
              color: applicationStatusColors[item.status],
            };
        return (
          <UnstyledButton
            key={item.id}
            component={Link}
            to={applicationPath(item.id)}
            className={classes.listRow}
          >
            <Group justify="space-between" wrap="nowrap" gap="md">
              <Group gap="sm" wrap="nowrap" miw={0}>
                <Avatar radius="xl" color="primary" variant="light">
                  {getInitials(item.studentName)}
                </Avatar>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>
                    {item.studentName}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {item.applicationNumber} · {item.programName}
                  </Text>
                </div>
              </Group>
              <Stack gap={4} align="flex-end">
                <Badge variant="dot" color={badge.color} style={{ whiteSpace: "nowrap" }}>
                  {badge.label ?? "—"}
                </Badge>
                <Ago at={item.submittedAt} />
              </Stack>
            </Group>
          </UnstyledButton>
        );
      })}
    </WidgetCard>
  );
}

// --- Review queue ---

const reasonStyle: Record<TAttentionReason, { color: string; icon: typeof IconAlertCircle }> = {
  manualReview: { color: "orange", icon: IconAlertCircle },
  missingDocuments: { color: "yellow", icon: IconFileAlert },
  assessmentFailed: { color: "red", icon: IconX },
};

/** Applications waiting for a person, oldest first, each with why. */
export function ReviewQueue({ attention, queueTo }: { attention: IDashboard["attention"]; queueTo: string }) {
  return (
    <WidgetCard
      title="Review Queue"
      description={
        attention.total
          ? `${attention.total} ${attention.total === 1 ? "application needs" : "applications need"} a person, oldest first`
          : "Applications that need a person"
      }
      link={attention.total ? { label: `View all (${attention.total})`, to: queueTo } : undefined}
      padded={false}
    >
      {!attention.items.length && <Empty text="Nothing is waiting. All clear." />}
      {attention.items.map((item) => {
        const first = item.reasons[0];
        const style = (first && reasonStyle[first.code]) ?? reasonStyle.manualReview;
        return (
          <UnstyledButton
            key={item.id}
            component={Link}
            to={applicationPath(item.id)}
            className={classes.listRow}
          >
            <Group justify="space-between" wrap="nowrap" gap="md">
              <Group gap="sm" wrap="nowrap" miw={0}>
                <ThemeIcon size={38} radius="md" variant="light" color={style.color}>
                  <style.icon size={20} stroke={1.8} />
                </ThemeIcon>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>
                    {item.studentName}{" "}
                    <Text span size="xs" c="dimmed" fw={400}>
                      {item.applicationNumber}
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {item.reasons.map(({ label }) => label).join(" · ")}
                  </Text>
                </div>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Tooltip label={`Since ${formatDateTime(item.since)}`}>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                    Waiting {formatSince(item.since)}
                  </Text>
                </Tooltip>
                <IconChevronRight size={16} color="var(--mantine-color-gray-5)" />
              </Group>
            </Group>
          </UnstyledButton>
        );
      })}
    </WidgetCard>
  );
}

// --- Applications by program ---

/**
 * One bar per program, most first: a single series in one hue, the value written at the end of
 * each bar, so there is no legend or axis to read.
 */
export function ApplicationsByProgram({
  items,
  programsTo,
}: {
  items: IDashboard["programs"];
  programsTo: string;
}) {
  const total = items.reduce((sum, { count }) => sum + count, 0);

  return (
    <WidgetCard
      title="Applications by Program"
      description={
        items.length
          ? `${total} ${total === 1 ? "application" : "applications"} across ${items.length} ${items.length === 1 ? "program" : "programs"}`
          : "Where students apply"
      }
      link={{ label: "Programs", to: programsTo }}
    >
      {!items.length ? (
        <Empty text="No submitted applications yet." />
      ) : (
        <BarList
          rows={items.map(({ id, name, code, count }) => ({
            key: id,
            name,
            tag: code,
            value: count,
            shown: count,
            tooltip: `${name}: ${count} ${count === 1 ? "application" : "applications"} (${Math.round((count / total) * 100)}%)`,
          }))}
        />
      )}
    </WidgetCard>
  );
}

/**
 * Rows of a name and a number over a bar; the biggest row fills its track. Shared by Applications by
 * Program and AI Usage (by model, by operation). `value` sizes the bar, `shown` is the text.
 */
export function BarList({
  rows,
}: {
  rows: {
    key: string | number;
    name: string;
    tag?: string;
    value: number;
    shown: ReactNode;
    tooltip: string;
  }[];
}) {
  const max = Math.max(0, ...rows.map(({ value }) => value));
  return (
    <Stack gap="lg">
      {rows.map(({ key, name, tag, value, shown, tooltip }) => (
        <Tooltip key={key} label={tooltip}>
          <div className={classes.programRow}>
            <Group justify="space-between" gap="sm" wrap="nowrap" mb={6}>
              <Text size="sm" fw={500} truncate>
                {name}{" "}
                {tag && (
                  <Text span size="xs" c="dimmed">
                    {tag}
                  </Text>
                )}
              </Text>
              <Text size="sm" fw={600} style={{ whiteSpace: "nowrap" }}>
                {shown}
              </Text>
            </Group>
            <div className={classes.programTrack}>
              <div className={classes.programFill} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
            </div>
          </div>
        </Tooltip>
      ))}
    </Stack>
  );
}

// --- Applications over time ---

/** Submissions over the period: a bar per day, week or month (TrendChart picks by length). */
export function ApplicationsOverTime({ items }: { items: IDashboard["trend"] }) {
  const total = items.reduce((sum, { count }) => sum + count, 0);

  return (
    <WidgetCard
      title="Applications Over Time"
      description={
        items.length
          ? `${total} submitted, ${trendRange(items)}. One bar per ${trendUnit(items.length)}.`
          : "Submissions over time"
      }
    >
      <TrendChart
        days={items.map(({ date, count }) => ({ date, value: count }))}
        tooltip={(bucket) => `${bucket.label}: ${bucket.value} submitted`}
        label={`Applications submitted over time: ${total} in total`}
      />
    </WidgetCard>
  );
}

// --- Recent activity ---

const activityStyle: Record<string, { color: string; icon: typeof IconFilePlus }> = {
  created: { color: "primary", icon: IconFilePlus },
  submitted: { color: "green", icon: IconSend },
  document_uploaded: { color: "violet", icon: IconFileUpload },
};

const MAX_ACTIVITY = 6;

export function RecentActivity({ items }: { items: IDashboard["activity"] }) {
  return (
    <WidgetCard title="Recent Activity" description="What happened across all applications">
      {!items.length ? (
        <Empty text="Nothing has happened yet." />
      ) : (
        // Tighter than Mantine's default spacing, so the feed stays as tall as its neighbour.
        <Timeline bulletSize={28} lineWidth={2} styles={{ item: { marginTop: 0, paddingBottom: 18 } }}>
          {items.slice(0, MAX_ACTIVITY).map((item, index) => {
            const style = activityStyle[item.type] ?? activityStyle.created;
            return (
              <Timeline.Item
                key={`${item.applicationId}-${item.at}-${index}`}
                bullet={
                  <ThemeIcon size={28} radius="xl" variant="light" color={style.color}>
                    <style.icon size={15} stroke={1.8} />
                  </ThemeIcon>
                }
              >
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <div style={{ minWidth: 0 }}>
                    <Anchor
                      component={Link}
                      to={applicationPath(item.applicationId)}
                      size="sm"
                      fw={600}
                      c="inherit"
                    >
                      {item.label}
                    </Anchor>
                    <Text size="xs" c="dimmed" truncate>
                      {item.applicationNumber}
                      {item.userName ? ` · by ${item.userName}` : ""}
                    </Text>
                  </div>
                  <Ago at={item.at} />
                </Group>
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}
    </WidgetCard>
  );
}
