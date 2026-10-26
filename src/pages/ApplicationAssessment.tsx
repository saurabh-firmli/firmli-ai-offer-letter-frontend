import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconFileText,
  IconQuestionMark,
  IconRobot,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatUsd, formatTokens } from "../lib/aiUsage";
import { IApplication, downloadDocument, outcomeColors, useApplicationOptions } from "../lib/applications";
import {
  IAssessmentCriterion,
  IAssessmentDocument,
  IAssessmentRun,
  criterionResultColors,
  criterionResultLabels,
  useAssessmentRun,
  useAssessmentRuns,
  useLatestAssessment,
  useRunAssessment,
} from "../lib/assessments";
import { useCan } from "../lib/auth";
import { IEligibilityOptions, ruleParts, useEligibilityOptions } from "../lib/eligibility";
import errorHandler from "../lib/errors";
import { formatDateTime } from "../lib/utils";

const percent = (value: number | null) => (value === null ? null : `${Math.round(value * 100)}%`);

const RESULT_ICONS = { met: IconCheck, not_met: IconX, unclear: IconQuestionMark };

/** One criterion's result: what was found against what is needed, with the evidence and its document. */
function CriterionRow({
  criterion,
  documentName,
  options,
}: {
  criterion: IAssessmentCriterion;
  documentName?: string;
  options: IEligibilityOptions | undefined; // the operator words ("one of")
}) {
  // A reviewer's override counts over the AI's result; both show.
  const result = criterion.finalResult ?? criterion.result;
  const Icon = RESULT_ICONS[result];
  const { symbol, word, values, unit } = ruleParts(criterion, options);
  const needed = `${symbol ?? word} ${values.join(", ")}${unit ? ` ${unit}` : ""}`;

  return (
    <Group
      gap="sm"
      wrap="nowrap"
      align="flex-start"
      py="sm"
      style={{ borderTop: "1px solid var(--firmli-border-lighter)" }}
    >
      <ThemeIcon size={28} radius="xl" variant="light" color={criterionResultColors[result]}>
        <Icon size={16} />
      </ThemeIcon>
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Group gap="xs" miw={0}>
            <Text fw={600} size="sm">
              {criterion.name}
            </Text>
            {!criterion.isMandatory && (
              <Tooltip label="Shown, but doesn't decide the outcome">
                <Badge size="xs" variant="light" color="gray">
                  Optional
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Badge variant="light" color={criterionResultColors[result]}>
            {criterionResultLabels[result]}
          </Badge>
        </Group>
        <Text size="sm">
          Found{" "}
          <Text span fw={700}>
            {criterion.foundValue ?? "no clear value"}
          </Text>
          <Text span c="dimmed">
            {" "}
            · needs {needed}
            {criterion.confidence !== null && ` · ${percent(criterion.confidence)} sure`}
          </Text>
        </Text>
        {criterion.override && (
          <Text size="xs">
            <Text span c="dimmed" inherit>
              AI: {criterionResultLabels[criterion.result]} · Reviewer
              {criterion.override.by ? ` (${criterion.override.by.name})` : ""}:{" "}
            </Text>
            <Text span fw={600} inherit>
              {criterionResultLabels[criterion.override.result]}
            </Text>
            <Text span c="dimmed" inherit>
              {" "}
              — {criterion.override.note}
            </Text>
          </Text>
        )}
        {criterion.evidence && (
          <Text size="xs" c="dimmed" fs="italic" lineClamp={2}>
            {criterion.evidence}
          </Text>
        )}
        <Group gap="md">
          {criterion.sourceDocumentId && (
            <Anchor
              component="button"
              type="button"
              size="xs"
              onClick={() =>
                downloadDocument(criterion.sourceDocumentId!).catch((error) =>
                  errorHandler(error, "Could not open the file")
                )
              }
            >
              <Group gap={4} wrap="nowrap">
                <IconFileText size={12} />
                {documentName ?? "Source document"}
              </Group>
            </Anchor>
          )}
          {criterion.reasoning && (
            <Tooltip label={criterion.reasoning} multiline maw={360}>
              <Text
                size="xs"
                c="dimmed"
                td="underline"
                style={{ textDecorationStyle: "dotted", cursor: "help" }}
              >
                Why?
              </Text>
            </Tooltip>
          )}
        </Group>
      </Stack>
    </Group>
  );
}

/** What the AI read from one file: its declared and detected type, whether it could be read, the fields. */
export function DocumentReadingView({ document }: { document: IAssessmentDocument }) {
  return (
    <div>
      <Group justify="space-between" gap="xs">
        <div>
          <Text size="sm" fw={600}>
            {document.originalName}
          </Text>
          <Text size="xs" c="dimmed">
            Sent as {document.documentType}
            {document.detectedType && ` · reads as ${document.detectedType}`}
          </Text>
        </div>
        <Group gap={6}>
          {document.typeMatches === false && (
            <Badge variant="light" color="orange">
              Not the declared type
            </Badge>
          )}
          <Badge variant="light" color={document.status === "completed" ? "green" : "red"}>
            {document.status === "completed"
              ? "Read"
              : document.status === "unsupported"
                ? "Unsupported"
                : "Failed"}
          </Badge>
        </Group>
      </Group>
      {document.errorMessage && (
        <Text size="xs" c="red" mt={4}>
          {document.errorMessage}
        </Text>
      )}
      {document.fields && document.fields.length > 0 && (
        <Table mt="xs" verticalSpacing={4} horizontalSpacing="sm" fz="xs" withTableBorder>
          <Table.Tbody>
            {document.fields.map((field) => (
              <Table.Tr key={field.name}>
                <Table.Td c="dimmed" w="40%">
                  {field.name}
                </Table.Td>
                <Table.Td fw={500}>{field.value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </div>
  );
}

/** A finished run: the outcome and why, each criterion's result, and what was read from each file. */
function RunResult({ run }: { run: IAssessmentRun }) {
  const options = useApplicationOptions();
  const eligibility = useEligibilityOptions();
  const outcomeLabel = run.outcome
    ? (options.data?.outcomes.find(({ value }) => value === run.outcome)?.label ?? run.outcome)
    : null;
  const documentNames = new Map(
    run.documents.map(({ documentId, originalName }) => [documentId, originalName])
  );
  const mandatory = run.criteria.filter(({ isMandatory }) => isMandatory);
  const optional = run.criteria.filter(({ isMandatory }) => !isMandatory);
  const meta = [
    run.eligibilityVersion !== null && `Rules v${run.eligibilityVersion}`,
    run.tokens !== null && `${formatTokens(run.tokens)} tokens`,
    run.costUsd !== null && formatUsd(run.costUsd),
    run.triggeredBy ? `Run by ${run.triggeredBy.name}` : "Ran automatically",
    formatDateTime(run.completedAt ?? run.startedAt),
  ].filter(Boolean);

  return (
    <Stack gap="md">
      {/* The decision */}
      <Group justify="space-between" align="flex-start" gap="md">
        <div>
          <Group gap="xs">
            {outcomeLabel && (
              <Badge size="lg" variant="light" color={outcomeColors[run.outcome!]}>
                {outcomeLabel}
              </Badge>
            )}
            {run.confidence !== null && (
              <Text size="sm" fw={600}>
                {percent(run.confidence)} confidence
              </Text>
            )}
            {run.escalated && (
              <Tooltip label="The first answer was unsure, so the escalation model checked it again">
                <Badge variant="outline" color="violet" leftSection={<IconSparkles size={12} />}>
                  Escalated
                </Badge>
              </Tooltip>
            )}
          </Group>
          {run.summary && (
            <Text size="sm" mt={6}>
              {run.summary}
            </Text>
          )}
        </div>
        <Text size="xs" c="dimmed" ta="right">
          {meta.join(" · ")}
        </Text>
      </Group>

      {run.flags.length > 0 && (
        <Group gap={6}>
          {run.flags.map((flag) => (
            <Badge
              key={flag.code}
              variant="light"
              color="red"
              radius="sm"
              leftSection={<IconAlertTriangle size={12} />}
            >
              {flag.label}
            </Badge>
          ))}
        </Group>
      )}

      {/* Mandatory criteria decide; optional ones are shown after them. */}
      {run.criteria.length > 0 && (
        <div>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
            Criteria · {mandatory.filter((item) => (item.finalResult ?? item.result) === "met").length} of{" "}
            {mandatory.length} mandatory met
          </Text>
          {[...mandatory, ...optional].map((criterion) => (
            <CriterionRow
              key={criterion.criterionId}
              criterion={criterion}
              options={eligibility.data}
              documentName={
                criterion.sourceDocumentId ? documentNames.get(criterion.sourceDocumentId) : undefined
              }
            />
          ))}
        </div>
      )}

      {/* What the AI read from each file */}
      {run.documents.length > 0 && (
        <Accordion variant="contained" radius="md" chevronPosition="right">
          <Accordion.Item value="documents">
            <Accordion.Control icon={<IconFileText size={16} />}>
              <Text size="sm" fw={500}>
                Documents read ({run.documents.length})
                {run.documents.some(
                  ({ status, typeMatches }) => status !== "completed" || typeMatches === false
                ) && (
                  <Text span c="orange" size="sm">
                    {" "}
                    · needs a look
                  </Text>
                )}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {run.documents.map((document) => (
                  <DocumentReadingView key={document.documentId} document={document} />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </Stack>
  );
}

/**
 * The AI Assessment card of an application: Run Assessment, the run in progress (checked every few
 * seconds), the latest result or failure, and earlier runs.
 */
export default function ApplicationAssessment({ application }: { application: IApplication }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const appRunning = application.assessmentStatus === "in_progress";
  const latest = useLatestAssessment(application.id, appRunning);
  const runs = useAssessmentRuns(application.id);
  const run = useRunAssessment();
  const options = useApplicationOptions();
  const outcomeText = (value: string | null) =>
    value ? (options.data?.outcomes.find((item) => item.value === value)?.label ?? value) : null;
  const [viewingId, setViewingId] = useState<number | null>(null); // an earlier run; null = the latest
  const earlier = useAssessmentRun(viewingId);

  const running = appRunning || latest.data?.status === "in_progress";

  // When a run finishes, the application, the queue and the dashboard have changed too.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
    wasRunning.current = running;
  }, [running, queryClient]);

  // Why the button can't be used right now (the API would answer 409).
  const blocked =
    application.status === "draft"
      ? "Submit the application before assessing it"
      : running
        ? "An assessment is already running"
        : application.status === "manual_review"
          ? "In manual review: return it for reassessment first"
          : null;

  const start = () =>
    run.mutate(application.id, {
      onSuccess: () =>
        notifications.show({
          color: "green",
          title: "Assessment started",
          message: `${application.applicationNumber}: results show here in about a minute.`,
        }),
      // e.g. no OpenAI key yet: "Add your institution's OpenAI API key in Settings first"
      onError: (error) => errorHandler(error, "Could not start the assessment"),
    });

  const shown = viewingId ? earlier.data : latest.data;
  const history = (runs.data ?? []).filter(({ id }) => id !== latest.data?.id);

  return (
    <Card withBorder radius="lg" shadow="xs" padding="lg">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Title order={3} fz={16}>
            AI Assessment
          </Title>
          {viewingId && (
            <Badge variant="outline" color="gray">
              Earlier run
            </Badge>
          )}
        </Group>
        {can("applications", "create") && (
          <Tooltip label={blocked} disabled={!blocked}>
            {/* data-disabled (not disabled) so the reason still shows on hover */}
            <Button
              size="sm"
              leftSection={<IconRobot size={16} />}
              onClick={() => !blocked && start()}
              loading={run.isPending}
              data-disabled={blocked ? true : undefined}
            >
              {latest.data ? "Run Again" : "Run Assessment"}
            </Button>
          </Tooltip>
        )}
      </Group>

      {latest.isLoading || (viewingId && earlier.isLoading) ? (
        <Stack gap="sm">
          <Skeleton h={24} w="40%" />
          <Skeleton h={14} w="70%" />
          <Skeleton h={60} />
        </Stack>
      ) : running && !viewingId ? (
        <Stack gap="xs">
          <Group gap="sm">
            <ThemeIcon variant="light" color="violet" radius="md">
              <IconRobot size={18} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600}>
                The AI is reading the documents and checking the rules
              </Text>
              <Text size="xs" c="dimmed">
                Usually 10–60 seconds; longer when many are queued. This updates by itself.
              </Text>
            </div>
          </Group>
          <Progress value={100} animated striped color="violet" size="sm" />
        </Stack>
      ) : !shown ? (
        <Text size="sm" c="dimmed">
          {application.status === "draft"
            ? "A draft isn't assessed. Submit it and the AI checks it against the program's rules."
            : "Not assessed yet. With Automatic assessment on (Settings) it runs on submit; or use Run Assessment."}
        </Text>
      ) : shown.status === "failed" ? (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertTriangle size={18} />}
          title="The assessment failed"
        >
          {shown.errorMessage ?? "No reason was given."}
          <Text size="xs" c="dimmed" mt={4}>
            {formatDateTime(shown.startedAt)}. Fix the cause (e.g. the OpenAI key in Settings) and run it
            again.
          </Text>
        </Alert>
      ) : (
        <RunResult run={shown} />
      )}

      {/* Earlier runs, newest first */}
      {history.length > 0 && (
        <Stack gap={4} mt="lg" pt="md" style={{ borderTop: "1px solid var(--firmli-divider)" }}>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Earlier runs
            </Text>
            {viewingId && (
              <Anchor component="button" type="button" size="xs" onClick={() => setViewingId(null)}>
                Back to the latest
              </Anchor>
            )}
          </Group>
          {history.map((item) => (
            <UnstyledButton key={item.id} onClick={() => setViewingId(item.id)} py={4}>
              <Group justify="space-between" gap="xs">
                <Text size="sm" fw={item.id === viewingId ? 700 : 400}>
                  {formatDateTime(item.startedAt)}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.status === "failed"
                    ? "Failed"
                    : [
                        outcomeText(item.outcome),
                        percent(item.confidence),
                        item.costUsd !== null && formatUsd(item.costUsd),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      )}
    </Card>
  );
}
