import { useEffect, useState } from "react";
import { Alert, Checkbox, Select, SimpleGrid, Skeleton, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconRefresh, IconUserCheck } from "@tabler/icons-react";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import SearchableSelect from "../components/SearchableSelect";
import { useEligibilityOptions } from "../lib/eligibility";
import errorHandler from "../lib/errors";
import { applyFormErrorMessages } from "../lib/forms";
import {
  IReview,
  TReviewPriority,
  useAssignReview,
  useRequestDocuments,
  useReturnForReassessment,
  useReview,
  useReviewOptions,
} from "../lib/reviews";
import { NOTE_MAX as REVIEW_NOTE_MAX, useAddNote } from "../lib/notes";
import { formatDateTime } from "../lib/utils";
import { NoteItem } from "./ApplicationNotes";

/* The three Manual Review actions, each a small dialog. They work on open cases only (409 otherwise). */

const NOTE_MAX = 2000;

interface IDialogProps {
  review: IReview | null; // null = closed
  onClose: () => void;
}

const subtitle = (review: IReview | null) =>
  review
    ? `${review.application.applicationNumber} · ${review.student.name} · ${review.program.name}`
    : undefined;

/** Assign or reassign a reviewer, with the priority and a note for them. */
export function AssignReviewerForm({ review, onClose }: IDialogProps) {
  const options = useReviewOptions(Boolean(review));
  const assign = useAssignReview();
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TReviewPriority>("normal");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!review) return;
    setReviewerId(review.reviewer ? String(review.reviewer.id) : null);
    setPriority(review.priority);
    setNote("");
    setError(null);
  }, [review]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!review) return;
    if (!reviewerId) {
      setError("Select a reviewer");
      return;
    }
    assign.mutate(
      { id: review.id, reviewerId: Number(reviewerId), priority, note: note.trim() || undefined },
      {
        onSuccess: ({ data }) => {
          notifications.show({
            color: "green",
            title: review.reviewer ? "Reviewer changed" : "Reviewer assigned",
            message: `${data.application.applicationNumber} · ${data.reviewer?.name}`,
          });
          onClose();
        },
        onError: (err) =>
          applyFormErrorMessages(err, { reviewerId: setError }) ||
          errorHandler(err, "Could not assign the reviewer"),
      }
    );
  };

  return (
    <FormModal
      opened={Boolean(review)}
      onClose={onClose}
      title={review?.reviewer ? "Reassign Reviewer" : "Assign Reviewer"}
      description={subtitle(review)}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <SearchableSelect
            label="Reviewer"
            withAsterisk
            placeholder={options.isLoading ? "Loading..." : "Select reviewer"}
            searchPlaceholder="Search users..."
            nothingFoundMessage="No user found"
            leftSection={<IconUserCheck size={16} />}
            description="Users whose role can work on manual reviews"
            data={(options.data?.reviewers ?? []).map((reviewer) => ({
              value: String(reviewer.id),
              label: reviewer.name,
              description: `${reviewer.roleName} · ${reviewer.email}`,
            }))}
            value={reviewerId}
            onChange={(value) => {
              setReviewerId(value);
              setError(null);
            }}
            error={error}
          />
          <Select
            label="Priority"
            data={options.data?.priorities ?? []}
            value={priority}
            onChange={(value) => value && setPriority(value as TReviewPriority)}
            allowDeselect={false}
          />
          <Textarea
            label="Assignment Note"
            placeholder="Optional note for the reviewer, e.g. Please check the GPA"
            autosize
            minRows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <FormActions
            onCancel={onClose}
            submitLabel={review?.reviewer ? "Reassign Reviewer" : "Assign Reviewer"}
            loading={assign.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}

/** Ask the student for documents by email; the missing ones are ticked to start with. */
export function RequestDocumentsForm({ review, onClose }: IDialogProps) {
  const detail = useReview(review?.id ?? null);
  const eligibility = useEligibilityOptions(Boolean(review));
  const request = useRequestDocuments();
  const [types, setTypes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Start from the documents the application is missing, once the case has loaded.
  useEffect(() => {
    if (!review) return;
    setMessage("");
    setError(null);
    setTypes((detail.data?.missingDocumentTypes ?? []).map(({ documentTypeId }) => String(documentTypeId)));
  }, [review, detail.data]);

  const lastRequest = detail.data?.documentRequests?.[0];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!review) return;
    if (!types.length) {
      setError("Pick at least one document");
      return;
    }
    request.mutate(
      { id: review.id, documentTypeIds: types.map(Number), message: message.trim() || undefined },
      {
        // Recorded even when the email didn't go out: say which one happened.
        onSuccess: ({ data, message: result }) => {
          const emailed = (data as IReview & { emailStatus?: string }).emailStatus === "sent";
          notifications.show({
            color: emailed ? "green" : "orange",
            title: emailed ? "Documents requested" : "Requested, but not emailed",
            message: result,
            autoClose: emailed ? undefined : 10_000,
          });
          onClose();
        },
        onError: (err) =>
          applyFormErrorMessages(err, { documentTypeIds: setError }) ||
          errorHandler(err, "Could not request documents"),
      }
    );
  };

  return (
    <FormModal
      opened={Boolean(review)}
      onClose={onClose}
      title="Request Documents"
      description={subtitle(review)}
      size={600}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          {lastRequest && (
            <Alert variant="light" color="gray">
              Last request on {formatDateTime(lastRequest.createdAt)}
              {lastRequest.requestedBy ? ` by ${lastRequest.requestedBy.name}` : ""}
              {lastRequest.emailStatus !== "sent" && " (the student wasn't emailed)"}.
            </Alert>
          )}
          {detail.isLoading || eligibility.isLoading ? (
            <SimpleGrid cols={2} spacing="xs">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} h={20} />
              ))}
            </SimpleGrid>
          ) : (
            <Checkbox.Group
              label="Documents to ask for"
              description={
                detail.data?.missingDocumentTypes?.length
                  ? "The missing ones are ticked."
                  : "Nothing required is missing; pick what you need."
              }
              withAsterisk
              value={types}
              onChange={(value) => {
                setTypes(value);
                setError(null);
              }}
              error={error}
            >
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" mt="xs">
                {(eligibility.data?.documentTypes ?? []).map(({ id, label }) => (
                  <Checkbox key={id} value={String(id)} label={label} />
                ))}
              </SimpleGrid>
            </Checkbox.Group>
          )}
          <Textarea
            label="Message to the Student"
            placeholder="e.g. Please send clear scans of both pages."
            description={`Goes into the email as written, to ${detail.data?.studentEmail ?? "the student"}.`}
            autosize
            minRows={3}
            maxLength={NOTE_MAX}
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
          />
          <FormActions onCancel={onClose} submitLabel="Send Request" loading={request.isPending} />
        </Stack>
      </form>
    </FormModal>
  );
}

/** Send the application back to the AI, e.g. once the missing documents are uploaded. */
export function ReturnForReassessmentForm({ review, onClose }: IDialogProps) {
  const reassess = useReturnForReassessment();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (review) setNote("");
  }, [review]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!review) return;
    reassess.mutate(
      { id: review.id, note: note.trim() || undefined },
      {
        onSuccess: () => {
          notifications.show({
            color: "green",
            title: "Returned for reassessment",
            message: `${review.application.applicationNumber} goes back to the AI assessment`,
          });
          onClose();
        },
        onError: (err) => errorHandler(err, "Could not return the application"),
      }
    );
  };

  return (
    <FormModal
      opened={Boolean(review)}
      onClose={onClose}
      title="Return for Reassessment"
      description={subtitle(review)}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <Alert variant="light" color="primary" icon={<IconRefresh size={18} />}>
            The AI checks the application again. This case is closed; if it still needs a person, a new one
            opens.
          </Alert>
          {review && review.missingDocuments > 0 && (
            <Text size="sm" c="orange">
              {review.missingDocuments} required{" "}
              {review.missingDocuments === 1 ? "document is" : "documents are"} still missing.
            </Text>
          )}
          <Textarea
            label="Note"
            placeholder="Optional, e.g. The student uploaded the missing transcript."
            autosize
            minRows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <FormActions
            onCancel={onClose}
            submitLabel="Return for Reassessment"
            loading={reassess.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}

/** Add review note: on any case, resolved ones too. Shows the application's latest notes above. */
export function AddReviewNoteForm({ review, onClose }: IDialogProps) {
  const detail = useReview(review?.id ?? null);
  const add = useAddNote();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!review) return;
    setNote("");
    setError(null);
  }, [review]);

  const latest = (detail.data?.notes ?? []).slice(0, 3);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!review) return;
    if (!note.trim()) {
      setError("Write a note first");
      return;
    }
    add.mutate(
      { on: "review", id: review.id, note: note.trim() },
      {
        onSuccess: () => {
          notifications.show({
            color: "green",
            title: "Note added",
            message: review.application.applicationNumber,
          });
          onClose();
        },
        onError: (err) =>
          applyFormErrorMessages(err, { note: setError }) || errorHandler(err, "Could not add the note"),
      }
    );
  };

  return (
    <FormModal
      opened={Boolean(review)}
      onClose={onClose}
      title="Add Review Note"
      description={subtitle(review)}
      size={560}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          {detail.isLoading ? (
            <Skeleton h={40} />
          ) : (
            latest.length > 0 && (
              <Stack gap="sm">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Latest notes
                </Text>
                {latest.map((item) => (
                  <NoteItem key={item.id} note={item} />
                ))}
              </Stack>
            )
          )}
          <Textarea
            label="Note"
            withAsterisk
            placeholder="e.g. GPA fine; waiting for IELTS."
            description="Shows on the application too. Notes can't be edited or deleted."
            autosize
            minRows={3}
            maxLength={REVIEW_NOTE_MAX}
            value={note}
            onChange={(event) => {
              setNote(event.currentTarget.value);
              setError(null);
            }}
            error={error}
            data-autofocus
          />
          <FormActions onCancel={onClose} submitLabel="Add Note" loading={add.isPending} />
        </Stack>
      </form>
    </FormModal>
  );
}
