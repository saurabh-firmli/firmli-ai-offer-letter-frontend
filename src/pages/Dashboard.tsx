import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  SimpleGrid,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconClock,
  IconFileAlert,
  IconFileText,
  IconHourglass,
  IconInbox,
  IconMail,
  IconMailX,
  IconPlus,
  IconUserQuestion,
} from "@tabler/icons-react";
import { Link } from "react-router";
import ErrorState from "../components/ErrorState";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import PeriodFilter, { IPeriod } from "../components/PeriodFilter";
import SearchableSelect from "../components/SearchableSelect";
import { StatsPageSkeleton } from "../components/Skeletons";
import { applicationStatusColors } from "../lib/applications";
import { useCan, useMe } from "../lib/auth";
import { IDashboard, formatDuration, formatRate, useDashboard } from "../lib/dashboard";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import {
  RO_APPLICATIONS,
  RO_COMMUNICATIONS,
  RO_LETTERS,
  RO_MANUAL_REVIEW,
  RO_NEW_APPLICATION,
  RO_PROGRAMS,
} from "../routes";
import classes from "./Dashboard.module.css";
import {
  ApplicationsByProgram,
  ApplicationsOverTime,
  IKpiCardProps,
  KpiCard,
  RecentActivity,
  RecentApplications,
  ReviewQueue,
} from "./DashboardWidgets";

/** A number that isn't tracked yet (null) shows as "—", never 0. */
const show = (value: number | null) => (value === null ? "—" : value);

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

function DecisionsCard({ data }: { data: IDashboard }) {
  const { stats, rates } = data;
  // Where the submitted applications stand. Order keeps red and green apart (colour-blind safe), and
  // each segment also has a 2px gap, an icon and a label, so colour is never the only cue.
  const outcomes = [
    {
      label: "Conditional Offers",
      count: stats.conditionalOffers,
      icon: IconCircleCheck,
      color: "var(--mantine-color-green-8)",
    },
    {
      label: "Manual Review",
      count: stats.manualReview,
      icon: IconAlertCircle,
      color: "var(--mantine-color-orange-8)",
    },
    {
      label: "Pending",
      count: stats.pendingAssessments,
      icon: IconClock,
      color: "var(--mantine-color-gray-6)",
    },
    { label: "Rejections", count: stats.rejections, icon: IconCircleX, color: "var(--mantine-color-red-9)" },
  ];
  const shown = outcomes.reduce((sum, { count }) => sum + count, 0);
  // Rates count only assessed applications; null until something is assessed.
  const rateTiles = [
    { label: "Offer rate", value: formatRate(rates.offer) },
    { label: "Rejection rate", value: formatRate(rates.rejection) },
    { label: "Manual review rate", value: formatRate(rates.manualReview) },
  ];

  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" h="100%">
      <Title order={3} fz={18}>
        Decisions
      </Title>
      <Text size="sm" c="dimmed">
        {stats.totalApplications
          ? `Where the ${stats.totalApplications} submitted ${stats.totalApplications === 1 ? "application stands" : "applications stand"} · ${rates.assessed} assessed`
          : "Where the submitted applications stand"}
      </Text>

      <SimpleGrid cols={3} mt="lg" spacing="md">
        {rateTiles.map(({ label, value }) => (
          <div key={label}>
            <Text fz={26} fw={700} lh={1.1}>
              {value}
            </Text>
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          </div>
        ))}
      </SimpleGrid>

      {shown > 0 ? (
        <div
          className={classes.bar}
          role="img"
          aria-label="Applications by outcome"
          style={{ marginTop: 24 }}
        >
          {outcomes
            .filter(({ count }) => count > 0)
            .map(({ label, count, color }) => (
              <Tooltip key={label} label={`${label}: ${count} (${percent(count, shown)}%)`}>
                <div className={classes.segment} style={{ flexGrow: count, background: color }} />
              </Tooltip>
            ))}
        </div>
      ) : (
        <div className={classes.bar} style={{ marginTop: 24 }}>
          <div
            className={classes.segment}
            style={{ flexGrow: 1, background: "var(--firmli-border-light)" }}
          />
        </div>
      )}

      <SimpleGrid cols={{ base: 2, sm: 4 }} mt="md" spacing="sm">
        {outcomes.map(({ label, count, icon: Icon, color }) => (
          <Group key={label} gap={8} wrap="nowrap" align="flex-start">
            <Icon size={16} style={{ color, flexShrink: 0, marginTop: 2 }} />
            <div>
              <Text size="sm" fw={600}>
                {count}{" "}
                <Text span size="xs" c="dimmed" fw={400}>
                  {percent(count, shown)}%
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                {label}
              </Text>
            </div>
          </Group>
        ))}
      </SimpleGrid>

      {/* Every status with its count, drafts included. */}
      <Text fw={600} size="sm" mt="xl" pt="lg" className={classes.divider}>
        By Status
      </Text>
      <Group gap="sm" mt="sm">
        {data.statuses.map(({ value, label, count }) => (
          <Badge
            key={value}
            variant={count ? "light" : "outline"}
            color={count ? applicationStatusColors[value] : "gray"}
            size="lg"
            radius="sm"
            tt="none"
          >
            {label} · {count}
          </Badge>
        ))}
      </Group>
    </Card>
  );
}

function AttentionCard({ data }: { data: IDashboard }) {
  const { stats } = data;
  // What someone should act on, most urgent first. null = not tracked yet.
  const rows = [
    {
      label: "Manual Review",
      count: stats.manualReview,
      icon: IconAlertCircle,
      color: "orange",
      to: RO_MANUAL_REVIEW,
    },
    {
      label: "Pending Assessments",
      count: stats.pendingAssessments,
      icon: IconClipboardList,
      color: "primary",
      to: RO_APPLICATIONS,
    },
    {
      label: "Missing Documents",
      count: stats.missingDocuments,
      icon: IconFileAlert,
      color: "orange",
      to: RO_APPLICATIONS,
    },
    {
      label: "Unassigned",
      count: stats.unassigned,
      icon: IconUserQuestion,
      color: "violet",
      to: RO_APPLICATIONS,
    },
    {
      label: "Letters Waiting",
      count: stats.lettersWaiting,
      icon: IconFileText,
      color: "primary",
      to: `${RO_LETTERS}?status=pending_approval`,
    },
    {
      label: "Failed Emails",
      count: stats.failedEmails,
      icon: IconMailX,
      color: "red",
      to: `${RO_COMMUNICATIONS}?status=failed`,
    },
  ];
  const open = rows.reduce((sum, { count }) => sum + (count ?? 0), 0);

  return (
    <Card withBorder radius="lg" shadow="xs" padding={0} h="100%">
      <div style={{ padding: "var(--mantine-spacing-lg)", paddingBottom: "var(--mantine-spacing-md)" }}>
        <Title order={3} fz={18}>
          Needs Attention
        </Title>
        <Text size="sm" c="dimmed">
          {open ? `${open} items to look at` : "All clear"}
        </Text>
      </div>
      {rows.map(({ label, count, icon: Icon, color, to }) => (
        <UnstyledButton key={label} component={Link} to={to} className={classes.attentionRow}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={32} radius="md" variant="light" color={count ? color : "gray"}>
                <Icon size={18} stroke={1.8} />
              </ThemeIcon>
              <Text size="sm" fw={500} c={count ? undefined : "dimmed"}>
                {label}
              </Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <Badge variant={count ? "light" : "outline"} color={count ? color : "gray"} radius="sm">
                {show(count)}
              </Badge>
              <IconChevronRight size={16} color="var(--mantine-color-gray-5)" />
            </Group>
          </Group>
        </UnstyledButton>
      ))}
    </Card>
  );
}

export default function Dashboard() {
  const { data: me } = useMe();
  const can = useCan();
  const [period, setPeriod] = useState<IPeriod>({});
  const [programId, setProgramId] = useState<string | null>(null);
  const programs = useDropdown("programs");
  const dashboard = useDashboard({
    ...period,
    programId: programId ? Number(programId) : undefined,
  });
  const data = dashboard.data;
  const firstName = me?.name.split(" ")[0];

  const kpis: IKpiCardProps[] = data
    ? [
        {
          label: "Total Applications",
          value: data.stats.totalApplications,
          hint: data.stats.drafts
            ? `${data.stats.drafts} ${data.stats.drafts === 1 ? "draft" : "drafts"} not submitted yet`
            : "Submitted in this period",
          icon: IconFileText,
          color: "primary",
        },
        {
          label: "Received Today",
          value: data.stats.receivedToday,
          hint: data.stats.receivedToday ? "Submitted since midnight" : "None yet today",
          icon: IconInbox,
          color: "violet",
        },
        {
          label: "Avg Processing Time",
          value: formatDuration(data.stats.avgProcessingSeconds),
          hint: data.stats.avgProcessingSeconds === null ? "Nothing assessed yet" : "Per AI assessment run",
          icon: IconHourglass,
          color: "teal",
        },
        {
          label: "Emails Sent",
          value: show(data.stats.emailsSent),
          hint:
            data.stats.emailsSent === null
              ? "Not tracked yet"
              : data.stats.failedEmails
                ? `${data.stats.failedEmails} failed`
                : "None failed",
          icon: IconMail,
          color: "green",
        },
      ]
    : [];

  return (
    <Page>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        withBreadcrumbs={false}
        description={`Here's how admissions at ${me?.tenant?.name ?? "your company"} look.`}
        action={
          can("applications", "create") && (
            <Button component={Link} to={RO_NEW_APPLICATION} leftSection={<IconPlus size={16} />}>
              New Application
            </Button>
          )
        }
      />

      {/* The period and program apply to every count and chart except Received Today; Recent Applications,
          Items Requiring Attention and Recent Activity follow only the program. */}
      <Group gap="sm">
        <PeriodFilter onChange={setPeriod} />
        <SearchableSelect
          placeholder="All programs"
          searchPlaceholder="Search programs..."
          data={toSelectData(programs.data)}
          value={programId}
          onChange={setProgramId}
          clearable
          w={{ base: "100%", sm: 240 }}
          aria-label="Program"
        />
      </Group>

      {dashboard.isLoading ? (
        <StatsPageSkeleton />
      ) : dashboard.error || !data ? (
        <Card withBorder radius="lg" shadow="xs" padding={0}>
          <ErrorState error={dashboard.error} title="Could not load the dashboard" />
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: "sm", sm: "lg" }}>
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </SimpleGrid>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 7, lg: 8 }}>
              <DecisionsCard data={data} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5, lg: 4 }}>
              <AttentionCard data={data} />
            </Grid.Col>
          </Grid>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <RecentApplications items={data.recentApplications} viewAllTo={RO_APPLICATIONS} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <ReviewQueue attention={data.attention} queueTo={RO_MANUAL_REVIEW} />
            </Grid.Col>
          </Grid>

          <ApplicationsOverTime items={data.trend} />

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <ApplicationsByProgram items={data.programs} programsTo={RO_PROGRAMS} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <RecentActivity items={data.activity} />
            </Grid.Col>
          </Grid>
        </>
      )}
    </Page>
  );
}
