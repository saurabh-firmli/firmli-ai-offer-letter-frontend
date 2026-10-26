import { useState } from "react";
import { Anchor, Badge, Card, Grid, Group, Select, SimpleGrid, Table, Text, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconBolt, IconCoin, IconCpu, IconDatabase, IconRobot } from "@tabler/icons-react";
import { Link } from "react-router";
import DataState from "../components/DataState";
import ErrorState from "../components/ErrorState";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import PeriodFilter, { IPeriod } from "../components/PeriodFilter";
import { StatsPageSkeleton } from "../components/Skeletons";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { DateCell } from "../components/TableCells";
import {
  IAiUsageFilters,
  IAiUsageSummary,
  TAiCallStatus,
  TAiOperation,
  aiOperationLabels,
  formatTokens,
  formatUsd,
  useAiCalls,
  useAiUsageSummary,
} from "../lib/aiUsage";
import { useCan, useMe } from "../lib/auth";
import { modelGroups, useSettingsOptions } from "../lib/settings";
import { applicationPath } from "../routes";

import { BarList, Empty, IKpiCardProps, KpiCard, WidgetCard } from "./DashboardWidgets";
import TrendChart, { trendRange, trendUnit } from "../components/TrendChart";

const PAGE_SIZE = 20;

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;

/** "2.4s", "850ms"; null -> "—". */
const formatMs = (ms: number | null) =>
  ms === null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

function kpis({ totals }: IAiUsageSummary): IKpiCardProps[] {
  const cachedShare = totals.inputTokens
    ? Math.round((totals.cachedInputTokens / totals.inputTokens) * 100)
    : 0;
  return [
    {
      label: "Total Cost",
      value: formatUsd(totals.costUsd),
      hint: totals.unpricedRequests
        ? `Some costs unknown: ${plural(totals.unpricedRequests, "call")} without a price`
        : "In US dollars, at each call's price",
      icon: IconCoin,
      color: "green",
    },
    {
      label: "AI Calls",
      value: totals.requests.toLocaleString(),
      hint: totals.failed ? `${totals.failed.toLocaleString()} failed` : "None failed",
      icon: IconBolt,
      color: "primary",
    },
    {
      label: "Total Tokens",
      value: formatTokens(totals.totalTokens),
      hint: `${formatTokens(totals.inputTokens)} in · ${formatTokens(totals.outputTokens)} out`,
      icon: IconCpu,
      color: "violet",
    },
    {
      label: "Cached Input",
      value: formatTokens(totals.cachedInputTokens),
      hint: totals.inputTokens
        ? `${cachedShare}% of input, billed cheaper`
        : "Re-sent context, billed cheaper",
      icon: IconDatabase,
      color: "teal",
    },
  ];
}

/** A group's line in the breakdowns: calls · tokens · cost. */
const groupTooltip = (name: string, group: { requests: number; tokens: number; costUsd: number | null }) =>
  `${name}: ${plural(group.requests, "call")} · ${formatTokens(group.tokens)} tokens · ${formatUsd(group.costUsd)}`;

/**
 * What the institution's AI calls used and cost: totals, a daily chart, the split by model and by
 * operation, and the log of calls. Read only; the backend logs every call.
 */
export default function AiUsage() {
  const { data: me } = useMe();
  const can = useCan();
  const [period, setPeriod] = useState<IPeriod>({});
  const [operation, setOperation] = useState<TAiOperation | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [status, setStatus] = useState<TAiCallStatus | null>(null);
  const [page, setPage] = useState(1);

  const filters: IAiUsageFilters = {
    ...period,
    operation: operation ?? undefined,
    modelId: modelId ? Number(modelId) : undefined,
    status: status ?? undefined,
  };
  const summary = useAiUsageSummary(filters);
  const calls = useAiCalls({ ...filters, page, limit: PAGE_SIZE });
  // The models come from Settings; without that permission, from the models used so far.
  const settingsOptions = useSettingsOptions(can("settings", "read"));
  const modelOptions = settingsOptions.data
    ? modelGroups(settingsOptions.data.aiModels, ({ id, name }) => ({ value: String(id), label: name }))
    : (summary.data?.byModel ?? []).map(({ modelId, modelName }) => ({
        value: String(modelId),
        label: modelName,
      }));

  const data = summary.data;
  const list = calls.data;
  const hasFilters = Boolean(period.from || operation || modelId || status);

  // Every filter change starts the log again from page 1.
  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <Page>
      <PageHeader
        title="AI Usage"
        description={`Tokens and cost of the AI calls made for ${me?.tenant?.name ?? "your institution"}.`}
      />

      {/* Every filter applies to the numbers, the charts and the log. */}
      <Group gap="sm">
        <PeriodFilter onChange={withPageReset(setPeriod)} />
        <Select
          placeholder="All operations"
          data={toOptions(aiOperationLabels)}
          value={operation}
          onChange={(value) => withPageReset(setOperation)(value as TAiOperation | null)}
          clearable
          w={{ base: "100%", sm: 210 }}
        />
        <Select
          placeholder="All models"
          data={modelOptions}
          value={modelId}
          onChange={withPageReset(setModelId)}
          clearable
          w={{ base: "100%", sm: 180 }}
        />
        <Select
          placeholder="Any result"
          data={[
            { value: "success", label: "Succeeded" },
            { value: "failed", label: "Failed" },
          ]}
          value={status}
          onChange={(value) => withPageReset(setStatus)(value as TAiCallStatus | null)}
          clearable
          w={{ base: "100%", sm: 150 }}
        />
      </Group>

      {summary.isLoading ? (
        <StatsPageSkeleton />
      ) : summary.error || !data ? (
        <Card withBorder radius="lg" shadow="xs" padding={0}>
          <ErrorState error={summary.error} title="Could not load AI usage" />
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: "sm", sm: "lg" }}>
            {kpis(data).map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </SimpleGrid>

          <WidgetCard
            title="Usage Over Time"
            description={
              data.byDay.length
                ? `Tokens used, ${trendRange(data.byDay)}. One bar per ${trendUnit(data.byDay.length)}.`
                : "Tokens used over time"
            }
          >
            {data.totals.requests ? (
              <TrendChart
                days={data.byDay.map((day) => ({ ...day, value: day.tokens }))}
                tooltip={({ label, value, days }) => {
                  const priced = days.filter(({ costUsd }) => costUsd !== null);
                  const cost = priced.length
                    ? priced.reduce((sum, { costUsd }) => sum + (costUsd ?? 0), 0)
                    : null;
                  const calls = days.reduce((sum, { requests }) => sum + requests, 0);
                  return `${label}: ${plural(calls, "call")} · ${formatTokens(value)} tokens · ${formatUsd(cost)}`;
                }}
                formatValue={formatTokens}
                label={`AI tokens over time: ${formatTokens(data.totals.totalTokens)} in total`}
              />
            ) : (
              <Empty icon={IconBolt} text="No AI calls in this period." />
            )}
          </WidgetCard>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <WidgetCard title="By Model" description="Which models did the work, by cost">
                {data.byModel.length ? (
                  <BarList
                    rows={data.byModel.map((group) => ({
                      key: group.modelId,
                      name: group.modelName,
                      value: group.costUsd ?? 0,
                      shown:
                        group.costUsd === null
                          ? `${formatTokens(group.tokens)} tokens`
                          : formatUsd(group.costUsd),
                      tooltip: groupTooltip(
                        group.providerName ? `${group.modelName} (${group.providerName})` : group.modelName,
                        group
                      ),
                    }))}
                  />
                ) : (
                  <Empty icon={IconCpu} text="No AI calls yet." />
                )}
              </WidgetCard>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <WidgetCard title="By Operation" description="What the AI was used for, by cost">
                {data.byOperation.length ? (
                  <BarList
                    rows={data.byOperation.map((group) => ({
                      key: group.operation,
                      name: group.label,
                      value: group.costUsd ?? 0,
                      shown:
                        group.costUsd === null
                          ? `${formatTokens(group.tokens)} tokens`
                          : formatUsd(group.costUsd),
                      tooltip: groupTooltip(group.label, group),
                    }))}
                  />
                ) : (
                  <Empty icon={IconRobot} text="No AI calls yet." />
                )}
              </WidgetCard>
            </Grid.Col>
          </Grid>
        </>
      )}

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="lg" pb="md">
          <div>
            <Text fw={600} fz={18}>
              AI Calls
            </Text>
            <Text size="sm" c="dimmed">
              Every call, newest first.
            </Text>
          </div>
        </Group>
        <DataState
          isLoading={calls.isLoading}
          error={calls.error}
          errorTitle="Could not load the AI calls"
          isEmpty={!list?.items.length}
          emptyIcon={IconRobot}
          emptyTitle={hasFilters ? "No calls match your filters" : "No AI calls yet"}
          emptyText={
            hasFilters
              ? undefined
              : "Each document extraction and assessment shows up here with its tokens and cost."
          }
        >
          <Table.ScrollContainer minWidth={1000}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>When</Table.Th>
                  <Table.Th>Operation</Table.Th>
                  <Table.Th>Application</Table.Th>
                  <Table.Th>Tokens</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Duration</Table.Th>
                  <Table.Th>Result</Table.Th>
                  <Table.Th>Started By</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list?.items.map((call, index) => (
                  <Table.Tr key={call.id}>
                    <SerialCell index={index} offset={(list.page - 1) * list.limit} />
                    <Table.Td>
                      <DateCell value={call.createdAt} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {call.operationLabel}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {call.model
                          ? [call.model.name, call.model.provider].filter(Boolean).join(" · ")
                          : "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {call.application ? (
                        <Anchor
                          component={Link}
                          to={applicationPath(call.application.id)}
                          size="sm"
                          ff="monospace"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {call.application.applicationNumber}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Text size="sm">{formatTokens(call.totalTokens)}</Text>
                      <Text size="xs" c="dimmed">
                        {formatTokens(call.inputTokens)} in · {formatTokens(call.outputTokens)} out
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      {call.costUsd === null ? (
                        <Tooltip label="The model had no price when this call was made">
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        </Tooltip>
                      ) : (
                        <Text size="sm">{formatUsd(call.costUsd)}</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Text size="sm">{formatMs(call.durationMs)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {call.status === "failed" ? (
                        <Tooltip label={call.errorMessage ?? "No error message"} multiline maw={320}>
                          <Badge variant="light" color="red" leftSection={<IconAlertTriangle size={12} />}>
                            Failed
                          </Badge>
                        </Tooltip>
                      ) : (
                        <Badge variant="light" color="green">
                          Succeeded
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      {call.triggeredBy ? (
                        <Text size="sm">{call.triggeredBy.name}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          Automatic
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>

        <ListFooter data={list} page={page} onChange={setPage} />
      </Card>
    </Page>
  );
}
