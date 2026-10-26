import { useEffect, useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconExternalLink,
  IconInfoCircle,
  IconQuestionMark,
  IconX,
} from "@tabler/icons-react";
import { Link } from "react-router";
import FormDrawer from "../components/FormDrawer";
import FormSection from "../components/FormSection";
import OptionCards from "../components/OptionCards";
import { outcomeColors, useApplicationOptions } from "../lib/applications";
import {
  IAssessmentCriterion,
  criterionResultColors,
  criterionResultLabels,
  useLatestAssessment,
} from "../lib/assessments";
import { useCan } from "../lib/auth";
import { IEligibilityOptions, ruleParts, useEligibilityOptions } from "../lib/eligibility";
import errorHandler from "../lib/errors";
import { applyFormErrorMessages } from "../lib/forms";
import {
  IReview,
  priorityColors,
  useOverrideCriterion,
  useReview,
  useReviewDecision,
  useReviewOptions,
} from "../lib/reviews";
import { formatDateTime } from "../lib/utils";
import { applicationPath } from "../routes";
import { NoteItem } from "./ApplicationNotes";

const NOTE_MAX = 2000;
type TDecided = "conditional_offer" | "rejection";
const RESULT_ICONS = { met: IconCheck, not_met: IconX, unclear: IconQuestionMark };

/**
 * One criterion of the latest run: the AI's result, a reviewer's override if any, and (on an open
 * case) Met / Not met with a note, or Clear to drop the override. An override doesn't decide.
 */
function CriterionOverride({
  reviewId,
  criterion,
  options,
  editable,
}: {
  reviewId: number;
  criterion: IAssessmentCriterion;
  options: IEligibilityOptions | undefined;
  editable: boolean;
}) {
  const override = useOverrideCriterion();
  const [editing, setEditing] = useState<"met" | "not_met" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const result = criterion.finalResult ?? criterion.result;
  const Icon = RESULT_ICONS[result];
  const { symbol, word, values, unit } = ruleParts(criterion, options);

  const save = (value: "met" | "not_met" | null) => {
    if (value && !note.trim()) {
      setError("Say why, e.g. what you checked");
      return;
    }
    override.mutate(
      { reviewId, criterionId: criterion.criterionId, result: value, note: value ? note.trim() : undefined },
      {
        onSuccess: () => {
          setEditing(null);
          setNote("");
          notifications.show({
            color: "green",
            title: value ? "Result overridden" : "Override removed",
            message: criterion.name,
          });
        },
        onError: (err) =>
          applyFormErrorMessages(err, { note: setError }) || errorHandler(err, "Could not save the override"),
      }
    );
  };

  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start" miw={0}>
          <ThemeIcon size={26} radius="xl" variant="light" color={criterionResultColors[result]}>
            <Icon size={14} />
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Group gap={6}>
              <Text size="sm" fw={600}>
                {criterion.name}
              </Text>
              {!criterion.isMandatory && (
                <Badge size="xs" variant="light" color="gray">
                  Optional
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              Found <b>{criterion.foundValue ?? "no clear value"}</b> · needs {symbol ?? word}{" "}
              {values.join(", ")}
              {unit ? ` ${unit}` : ""}
            </Text>
            <Text size="xs" mt={2}>
              AI:{" "}
              <Text span c={criterionResultColors[criterion.result]} fw={600} inherit>
                {criterionResultLabels[criterion.result]}
              </Text>
              {criterion.override && (
                <>
                  {" · "}Reviewer{criterion.override.by ? ` (${criterion.override.by.name})` : ""}:{" "}
                  <Text span c={criterionResultColors[criterion.override.result]} fw={600} inherit>
                    {criterionResultLabels[criterion.override.result]}
                  </Text>
                  <Text span c="dimmed" inherit>
                    {" "}
                    — {criterion.override.note}
                  </Text>
                </>
              )}
            </Text>
            {criterion.evidence && (
              <Text size="xs" c="dimmed" fs="italic" lineClamp={2} mt={2}>
                {criterion.evidence}
              </Text>
            )}
          </div>
        </Group>
        {editable && !editing && (
          <Group gap={4} wrap="nowrap">
            <Button size="compact-xs" variant="light" color="green" onClick={() => setEditing("met")}>
              Met
            </Button>
            <Button size="compact-xs" variant="light" color="red" onClick={() => setEditing("not_met")}>
              Not met
            </Button>
            {criterion.override && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => save(null)}
                loading={override.isPending}
              >
                Clear
              </Button>
            )}
          </Group>
        )}
      </Group>

      {editing && (
        <Stack gap="xs" mt="sm">
          <SegmentedControl
            size="xs"
            value={editing}
            onChange={(value) => setEditing(value as "met" | "not_met")}
            data={[
              { value: "met", label: "Met" },
              { value: "not_met", label: "Not met" },
            ]}
            style={{ alignSelf: "flex-start" }}
          />
          <Textarea
            placeholder="Why, e.g. Saw the original IELTS certificate: 7.0"
            autosize
            minRows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => {
              setNote(event.currentTarget.value);
              setError(null);
            }}
            error={error}
            data-autofocus
          />
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="xs" onClick={() => save(editing)} loading={override.isPending}>
              Save Override
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  );
}

/**
 * A review case in one place: why it is here, the AI's assessment with the reviewer's overrides, the
 * notes, and the decision (Approve / Reject with a reason). A resolved case shows how it ended.
 */
export default function ReviewDrawer({ review, onClose }: { review: IReview | null; onClose: () => void }) {
  const can = useCan();
  const detail = useReview(review?.id ?? null);
  const run = useLatestAssessment(review?.application.id ?? null);
  const reviewOptions = useReviewOptions(Boolean(review));
  const appOptions = useApplicationOptions();
  const eligibility = useEligibilityOptions(Boolean(review));
  const decide = useReviewDecision();

  const [outcome, setOutcome] = useState<TDecided | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ outcome?: string; reason?: string }>({});

  const open = review ? review.status !== "resolved" : false;
  const canAct = can("reviews", "update") && open;
  const completed = run.data?.status === "completed" ? run.data : null;
  const suggested = completed?.suggestedOutcome;
  const suggestion = suggested === "conditional_offer" || suggested === "rejection" ? suggested : null;

  // A new case starts empty; the decision follows the suggestion until the reviewer picks one.
  useEffect(() => {
    setReason("");
    setErrors({});
    setOutcome(null);
  }, [review?.id]);
  const chosen = outcome ?? suggestion;

  const outcomeLabel = (value: string | null | undefined) =>
    value ? (appOptions.data?.outcomes.find((item) => item.value === value)?.label ?? value) : null;
  const resolutionLabel = reviewOptions.data?.resolutions?.find(
    (item) => item.value === review?.resolution
  )?.label;

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!review || !canAct) return;
    const next = {
      outcome: chosen ? undefined : "Pick Approve or Reject",
      reason: reason.trim() ? undefined : "Give the reason for the decision",
    };
    if (next.outcome || next.reason) {
      setErrors(next);
      return;
    }
    decide.mutate(
      { id: review.id, outcome: chosen!, reason: reason.trim() },
      {
        onSuccess: () => {
          notifications.show({
            color: "green",
            title: chosen === "conditional_offer" ? "Offer approved" : "Application rejected",
            message: review.application.applicationNumber,
          });
          onClose();
        },
        onError: (error) =>
          applyFormErrorMessages(error, {
            outcome: (message) => setErrors((current) => ({ ...current, outcome: message })),
            reason: (message) => setErrors((current) => ({ ...current, reason: message })),
          }) || errorHandler(error, "Could not save the decision"),
      }
    );
  };

  const notes = (detail.data?.notes ?? []).slice(0, 3);

  return (
    <FormDrawer
      opened={Boolean(review)}
      onClose={onClose}
      title={review ? `Review ${review.application.applicationNumber}` : "Review"}
      description={review ? `${review.student.name} · ${review.program.name}` : undefined}
      onSubmit={handleSubmit}
      submitLabel={chosen === "rejection" ? "Reject Application" : chosen ? "Approve Offer" : "Save Decision"}
      loading={decide.isPending}
      readOnly={!canAct}
      isDirty={Boolean(reason.trim())}
      size={680}
    >
      {review && (
        <>
          <FormSection
            title="Case"
            action={
              <Anchor component={Link} to={applicationPath(review.application.id)} size="sm">
                <Group gap={4}>
                  Open application <IconExternalLink size={14} />
                </Group>
              </Anchor>
            }
          >
            <Stack gap={6}>
              <Text size="sm">{review.reason ?? "No reason given"}</Text>
              <Group gap={6}>
                <Badge variant="dot" color={priorityColors[review.priority]}>
                  {reviewOptions.data?.priorities.find((item) => item.value === review.priority)?.label ??
                    review.priority}
                </Badge>
                {review.flags.map((flag) => (
                  <Badge key={flag.code} variant="light" color="red" radius="sm">
                    {flag.label}
                  </Badge>
                ))}
                {review.missingDocuments > 0 && (
                  <Badge variant="filled" color="red" radius="sm">
                    {review.missingDocuments} missing{" "}
                    {review.missingDocuments === 1 ? "document" : "documents"}
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                Reviewer: {review.reviewer?.name ?? "Unassigned"}
                {detail.data?.assignmentNote ? ` · "${detail.data.assignmentNote}"` : ""}
              </Text>
            </Stack>
          </FormSection>

          <FormSection title="AI Assessment">
            {run.isLoading ? (
              <Skeleton h={80} />
            ) : !completed ? (
              <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
                {run.data?.status === "failed"
                  ? "The last assessment failed, so there are no AI results to check. You can still decide."
                  : "There's no completed assessment for this application, so there are no AI results to check. You can still decide."}
              </Alert>
            ) : (
              <Stack gap="sm">
                <Group gap="xs">
                  {completed.outcome && (
                    <Badge variant="light" color={outcomeColors[completed.outcome]}>
                      AI: {outcomeLabel(completed.outcome)}
                    </Badge>
                  )}
                  {completed.confidence !== null && (
                    <Text size="sm" c="dimmed">
                      {Math.round(completed.confidence * 100)}% confidence
                    </Text>
                  )}
                </Group>
                {completed.summary && <Text size="sm">{completed.summary}</Text>}
                {completed.criteria.map((criterion) => (
                  <CriterionOverride
                    key={criterion.criterionId}
                    reviewId={review.id}
                    criterion={criterion}
                    options={eligibility.data}
                    editable={canAct}
                  />
                ))}
              </Stack>
            )}
          </FormSection>

          {notes.length > 0 && (
            <FormSection title="Latest Notes">
              <Stack gap="sm">
                {notes.map((item) => (
                  <NoteItem key={item.id} note={item} />
                ))}
              </Stack>
            </FormSection>
          )}

          <FormSection title="Decision">
            {open ? (
              canAct ? (
                <Stack gap="md">
                  <OptionCards
                    label="Outcome"
                    required
                    description={
                      suggestion
                        ? `The criteria${completed?.criteria.some((item) => item.override) ? ", with your overrides," : ""} say: ${outcomeLabel(suggestion)}.`
                        : undefined
                    }
                    data={[
                      {
                        value: "conditional_offer",
                        label: "Approve (Conditional Offer)",
                        icon: <IconCircleCheck size={16} />,
                      },
                      { value: "rejection", label: "Reject", icon: <IconCircleX size={16} /> },
                    ]}
                    value={chosen ?? ""}
                    onChange={(value) => {
                      setOutcome(value as TDecided);
                      setErrors((current) => ({ ...current, outcome: undefined }));
                    }}
                    error={errors.outcome}
                  />
                  <Textarea
                    label="Reason"
                    withAsterisk
                    placeholder="e.g. All met after checking the IELTS original"
                    description="Saved with the decision and shown on the application."
                    autosize
                    minRows={3}
                    maxLength={NOTE_MAX}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.currentTarget.value);
                      setErrors((current) => ({ ...current, reason: undefined }));
                    }}
                    error={errors.reason}
                  />
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  Your role can view this case but not decide it.
                </Text>
              )
            ) : (
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  {resolutionLabel ?? "Resolved"}
                </Text>
                {review.resolutionNote && <Text size="sm">{review.resolutionNote}</Text>}
                <Text size="xs" c="dimmed">
                  {review.resolvedBy ? `By ${review.resolvedBy.name}` : ""}
                  {review.resolvedAt ? ` · ${formatDateTime(review.resolvedAt)}` : ""}
                </Text>
              </Stack>
            )}
          </FormSection>
        </>
      )}
    </FormDrawer>
  );
}
