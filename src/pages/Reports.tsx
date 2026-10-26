import { useState } from "react";
import { Button, Card, Grid, Group, Progress, SimpleGrid, Table, Text, Tooltip } from "@mantine/core";
import {
  IconCircleCheck,
  IconCircleX,
  IconDownload,
  IconFileText,
  IconSchool,
  IconUserQuestion,
} from "@tabler/icons-react";
import ErrorState from "../components/ErrorState";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import PeriodFilter, { IPeriod } from "../components/PeriodFilter";
import SearchableSelect from "../components/SearchableSelect";
import { StatsPageSkeleton } from "../components/Skeletons";
import { EntityCell } from "../components/TableCells";
import TrendChart, { trendRange, trendUnit } from "../components/TrendChart";
import { formatDuration, formatRate } from "../lib/dashboard";
import errorHandler from "../lib/errors";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import { IReport, downloadReportCsv, useReport } from "../lib/reports";
import { BarList, Empty, IKpiCardProps, KpiCard, WidgetCard } from "./DashboardWidgets";

const share = (part: number, whole: number) => (whole ? ` (${Math.round((part / whole) * 100)}%)` : "");

function kpis({ kpis: k }: IReport): IKpiCardProps[] {
  return [
    {
      label: "Total Applications",
      value: k.totalApplications,
      hint: k.inProgress ? `${k.inProgress} still being processed` : "Submitted in this period",
      icon: IconFileText,
      color: "primary",
    },
    {
      label: "Conditional Offers",
      value: k.conditionalOffers,
      hint: `Outcome now${share(k.conditionalOffers, k.totalApplications)}`,
      icon: IconCircleCheck,
      color: "green",
    },
    {
      label: "Rejections",
      value: k.rejections,
      hint: `Outcome now${share(k.rejections, k.totalApplications)}`,
      icon: IconCircleX,
      color: "red",
    },
    {
      label: "In Manual Review",
      value: k.manualReviews,
      hint: k.manualReviews ? "Waiting for a person" : "Nothing waiting",
      icon: IconUserQuestion,
      color: "orange",
    },
  ];
}

/** The smaller figures: how complete, how sure and how quick, and how many decisions people made. */
function QualityCard({ report }: { report: IReport }) {
  const k = report.kpis;
  const items = [
    {
      label: "Assessment Completion",
      value: formatRate(k.assessmentCompletionRate),
      hint: "Have an outcome",
    },
    { label: "Avg Confidence", value: formatRate(k.avgConfidence), hint: "Of the AI's outcomes" },
    {
      label: "Document Completion",
      value: formatRate(k.documentCompletionRate),
      hint: "Every required document",
    },
    {
      label: "Avg Processing Time",
      value: formatDuration(k.avgProcessingSeconds),
      hint: "Per AI assessment run",
    },
    { label: "Processing", value: String(k.inProgress), hint: "Submitted or being assessed" },
    { label: "Decided by People", value: String(k.manualDecisions), hint: "Review decisions and changes" },
    {
      label: "Emails Sent",
      value: String(k.emailsSent),
      hint: "To students, every type",
    },
  ];
  return (
    <Card withBorder radius="lg" shadow="xs" padding="lg">
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }} spacing="lg">
        {items.map(({ label, value, hint }) => (
          <div key={label}>
            <Text size="xs" c="dimmed" fw={500}>
              {label}
            </Text>
            <Text fz={22} fw={700} lh={1.3}>
              {value}
            </Text>
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          </div>
        ))}
      </SimpleGrid>
    </Card>
  );
}

/** Per program: how many came in, how they ended, and the offer rate of the assessed ones. */
function ProgramsTable({ programs }: { programs: IReport["charts"]["programs"] }) {
  return (
    <WidgetCard
      title="By Program"
      description="Most applications first; offer rate is offers out of the assessed ones"
      padded={false}
    >
      {programs.length ? (
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Program</Table.Th>
                <Table.Th ta="right">Applications</Table.Th>
                <Table.Th ta="right">Offers</Table.Th>
                <Table.Th ta="right">Rejections</Table.Th>
                <Table.Th ta="right">Manual Review</Table.Th>
                <Table.Th w={200}>Offer Rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {programs.map((program) => (
                <Table.Tr key={program.id}>
                  <Table.Td>
                    <EntityCell icon={IconSchool} title={program.name} subtitle={program.code} />
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {program.total}
                  </Table.Td>
                  <Table.Td ta="right">{program.conditionalOffers}</Table.Td>
                  <Table.Td ta="right">{program.rejections}</Table.Td>
                  <Table.Td ta="right">{program.manualReviews}</Table.Td>
                  <Table.Td>
                    {program.offerRate === null ? (
                      <Text size="sm" c="dimmed">
                        Not assessed yet
                      </Text>
                    ) : (
                      <Tooltip label={`${program.conditionalOffers} of ${program.assessed} assessed`}>
                        <Group gap="sm" wrap="nowrap">
                          <Progress
                            value={program.offerRate * 100}
                            color="green"
                            size="sm"
                            radius="xl"
                            style={{ flex: 1 }}
                          />
                          <Text size="sm" fw={600} w={40} ta="right">
                            {formatRate(program.offerRate)}
                          </Text>
                        </Group>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Empty text="No applications in this period." />
      )}
    </WidgetCard>
  );
}

/**
 * Reports: how the applications submitted in a period went, in figures and charts, and the same
 * applications as a CSV. Needs Applications read, like the dashboard.
 */
export default function Reports() {
  const [period, setPeriod] = useState<IPeriod>({});
  const [programId, setProgramId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const programs = useDropdown("programs");
  const filters = { ...period, programId: programId ? Number(programId) : undefined };
  const report = useReport(filters);
  const data = report.data;

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadReportCsv(filters);
    } catch (error) {
      errorHandler(error, "Could not export the CSV");
    } finally {
      setExporting(false);
    }
  };

  const overTime = data?.charts.overTime ?? [];
  const assessments = data?.charts.assessments ?? [];
  const runs = assessments.reduce((sum, { completed }) => sum + completed, 0);
  const failedRuns = assessments.reduce((sum, { failed }) => sum + failed, 0);
  const outcomesTotal = (data?.charts.outcomes ?? []).reduce((sum, { count }) => sum + count, 0);

  return (
    <Page>
      <PageHeader
        title="Reports"
        description="How the applications submitted in a period went: outcomes, programs and the AI's work."
        action={
          <Button
            variant="secondary"
            leftSection={<IconDownload size={16} />}
            onClick={exportCsv}
            loading={exporting}
          >
            Export CSV
          </Button>
        }
      />

      {/* The same filters drive the figures, the charts and the CSV. */}
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

      {report.isLoading ? (
        <StatsPageSkeleton />
      ) : report.error || !data ? (
        <Card withBorder radius="lg" shadow="xs" padding={0}>
          <ErrorState error={report.error} title="Could not load the report" />
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: "sm", sm: "lg" }}>
            {kpis(data).map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </SimpleGrid>

          <QualityCard report={data} />

          <WidgetCard
            title="Applications Over Time"
            description={
              overTime.length
                ? `Submitted, ${trendRange(overTime)}. One bar per ${trendUnit(overTime.length)}.`
                : "Submitted applications"
            }
          >
            <TrendChart
              days={overTime.map((day) => ({ ...day, value: day.submitted }))}
              tooltip={({ label, value, days }) => {
                const sum = (key: "conditionalOffers" | "rejections" | "manualReviews") =>
                  days.reduce((total, day) => total + day[key], 0);
                return `${label}: ${value} submitted · ${sum("conditionalOffers")} offers · ${sum("rejections")} rejections · ${sum("manualReviews")} in review`;
              }}
              label={`Applications submitted over time: ${data.kpis.totalApplications} in total`}
            />
          </WidgetCard>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <WidgetCard title="Outcome Distribution" description="Where the applications ended up">
                {outcomesTotal ? (
                  <BarList
                    rows={data.charts.outcomes.map(({ value, label, count }) => ({
                      key: value,
                      name: label,
                      value: count,
                      shown: `${count}${share(count, outcomesTotal)}`,
                      tooltip: `${label}: ${count} of ${outcomesTotal} with an outcome`,
                    }))}
                  />
                ) : (
                  <Empty text="No outcomes in this period yet." />
                )}
              </WidgetCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <WidgetCard
                title="Assessment Performance"
                description={
                  runs || failedRuns
                    ? `${runs} completed AI runs${failedRuns ? `, ${failedRuns} failed` : ""}. One bar per ${trendUnit(assessments.length)}.`
                    : "Completed AI assessment runs"
                }
              >
                {runs || failedRuns ? (
                  <TrendChart
                    days={assessments.map((day) => ({ ...day, value: day.completed }))}
                    tooltip={({ label, value, days }) => {
                      const failed = days.reduce((total, day) => total + day.failed, 0);
                      const timed = days.filter((day) => day.avgSeconds !== null);
                      const avg = timed.length
                        ? timed.reduce((total, day) => total + (day.avgSeconds ?? 0), 0) / timed.length
                        : null;
                      return `${label}: ${value} completed · ${failed} failed · avg ${formatDuration(avg === null ? null : Math.round(avg))}`;
                    }}
                    label={`AI assessment runs over time: ${runs} completed`}
                  />
                ) : (
                  <Empty text="No AI assessments in this period yet." />
                )}
              </WidgetCard>
            </Grid.Col>
          </Grid>

          <ProgramsTable programs={data.charts.programs} />
        </>
      )}
    </Page>
  );
}
