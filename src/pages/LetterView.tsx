import { useEffect, useState } from "react";
import { Alert, Badge, Button, Skeleton, Stack, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconHourglass,
  IconInfoCircle,
  IconMail,
  IconReplace,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import ErrorState from "../components/ErrorState";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import { PdfFrame, PreviewModal, PreviewSummary } from "../components/TemplatePreview";
import { useCan } from "../lib/auth";
import errorHandler from "../lib/errors";
import { applyFormErrorMessages } from "../lib/forms";
import {
  ILetter,
  TLetterStatus,
  openLetterPdf,
  letterStatusColors,
  useLetter,
  useLetterStatusLabel,
  useLetterTypeLabel,
  useLetterViewUrl,
  useReviewLetter,
} from "../lib/letters";
import { emailSendStatusColors, useEmailStatusLabel } from "../lib/emails";
import { formatDateTime } from "../lib/utils";
import { SendEmailForm, emailStatusIcons } from "./EmailView";

const NOTE_MAX = 2000;

// The icon of the Approval step in the letter's summary, by its state.
const APPROVAL_ICONS: Record<TLetterStatus, typeof IconCheck> = {
  pending_approval: IconHourglass,
  approved: IconCheck,
  rejected: IconX,
  superseded: IconReplace,
};

/** Approve (note optional) or Reject (the reason is required) a letter waiting for approval. */
export function LetterReviewForm({
  letter,
  action,
  onClose,
}: {
  letter: ILetter | null; // null = closed
  action: "approve" | "reject";
  onClose: () => void;
}) {
  const review = useReviewLetter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isReject = action === "reject";

  useEffect(() => {
    if (!letter) return;
    setNote("");
    setError(null);
  }, [letter]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!letter) return;
    if (isReject && !note.trim()) {
      setError("Say what is wrong, so it can be fixed");
      return;
    }
    review.mutate(
      { id: letter.id, action, note: note.trim() },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: isReject ? "orange" : "green",
            title: isReject ? "Letter rejected" : "Letter approved",
            message: `${saved.referenceNumber} · ${saved.student.name}`,
          });
          onClose();
        },
        onError: (failure) =>
          applyFormErrorMessages(failure, { note: setError }) ||
          errorHandler(failure, isReject ? "Could not reject the letter" : "Could not approve the letter"),
      }
    );
  };

  return (
    <FormModal
      opened={Boolean(letter)}
      onClose={onClose}
      title={isReject ? "Reject Letter" : "Approve Letter"}
      description={letter ? `${letter.referenceNumber} · ${letter.student.name}` : undefined}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
            {isReject
              ? "The letter stays in the history. Fix the template or the application, then generate it again."
              : "The letter becomes the approved letter of this application."}
          </Alert>
          <Textarea
            label={isReject ? "Reason" : "Note"}
            withAsterisk={isReject}
            placeholder={isReject ? "e.g. Wrong intake on the letter" : "Optional, e.g. Looks good"}
            autosize
            minRows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => {
              setNote(event.currentTarget.value);
              setError(null);
            }}
            error={error}
            data-autofocus
          />
          <FormActions
            onCancel={onClose}
            submitLabel={isReject ? "Reject Letter" : "Approve Letter"}
            loading={review.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}

/**
 * One letter on screen, as generated: its status, who made and checked it, Download PDF and, while it
 * waits, Approve / Reject. The PDF is the official copy; this view is the same content, sanitized.
 */
export default function LetterView({ letterId, onClose }: { letterId: number | null; onClose: () => void }) {
  const can = useCan();
  const letter = useLetter(letterId);
  const pdf = useLetterViewUrl(letterId);
  const statusLabel = useLetterStatusLabel();
  const typeLabel = useLetterTypeLabel();
  const [reviewing, setReviewing] = useState<"approve" | "reject" | null>(null);
  const [sending, setSending] = useState(false);
  const data = letter.data;
  const waiting = data?.status === "pending_approval" && can("letters", "update");
  const emailStatusLabel = useEmailStatusLabel();

  // Who approved it, in a few words: the facts row of the summary.
  const approval = !data
    ? null
    : data.status === "pending_approval"
      ? { value: "Waiting for approval", hint: "Someone with Letters update approves or rejects it" }
      : data.status === "superseded"
        ? { value: "Replaced", hint: "A newer letter or a new decision" }
        : {
            value: `${data.status === "rejected" ? "Rejected" : "Approved"} ${data.reviewedBy ? `by ${data.reviewedBy.name}` : "automatically"}`,
            hint: data.reviewedBy ? formatDateTime(data.reviewedAt) : "By the Settings rules",
          };
  const email = data?.email;
  // A person's note (a rejection's reason); the automatic approval says so in the facts already.
  const showNote = data?.reviewNote && (data.status === "rejected" || data.reviewedBy);

  const toolbar = data && approval && (
    <PreviewSummary
      badges={
        <>
          <Badge variant="light" color={letterStatusColors[data.status]}>
            {statusLabel(data.status)}
          </Badge>
          <Badge variant="outline" color="gray">
            {typeLabel(data.letterType)}
          </Badge>
        </>
      }
      actions={
        <>
          {/* A fresh link: the one in the view may have expired. Phones may show only page 1 inline. */}
          <Button
            variant="secondary"
            size="xs"
            leftSection={<IconExternalLink size={14} />}
            onClick={() => openLetterPdf(data, { inline: true })}
          >
            Open in New Tab
          </Button>
          <Button
            variant="secondary"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={() => openLetterPdf(data)}
          >
            Download PDF
          </Button>
          {data.status === "approved" && can("communications", "create") && (
            <Button
              size="xs"
              variant={data.email ? "secondary" : "filled"}
              leftSection={<IconSend size={14} />}
              onClick={() => setSending(true)}
            >
              {data.email ? "Send Again" : "Send Email"}
            </Button>
          )}
          {waiting && (
            <>
              <Button
                variant="secondary"
                color="red"
                size="xs"
                leftSection={<IconX size={14} />}
                onClick={() => setReviewing("reject")}
              >
                Reject
              </Button>
              <Button size="xs" leftSection={<IconCheck size={14} />} onClick={() => setReviewing("approve")}>
                Approve
              </Button>
            </>
          )}
        </>
      }
      flow
      facts={[
        {
          icon: IconFileText,
          color: "primary",
          label: "Generated",
          value: formatDateTime(data.createdAt),
          hint: `${data.generatedBy ? `by ${data.generatedBy.name}` : "Automatically"} · Version ${data.version}`,
        },
        {
          icon: APPROVAL_ICONS[data.status] ?? IconFileText,
          color: letterStatusColors[data.status],
          label: "Approval",
          ...approval,
        },
        {
          icon: email ? emailStatusIcons[email.status] : IconMail,
          color: email ? emailSendStatusColors[email.status] : "gray",
          label: "Email to the student",
          value: email
            ? [emailStatusLabel(email.status), email.sentAt && formatDateTime(email.sentAt)]
                .filter(Boolean)
                .join(" · ")
            : "Not emailed yet",
          hint: `to ${data.student.email}`,
        },
      ]}
    >
      {showNote && (
        <Alert
          variant="light"
          color={data.status === "rejected" ? "red" : "gray"}
          icon={<IconInfoCircle size={18} />}
          title={data.status === "rejected" ? "Reason" : "Note"}
        >
          {data.reviewNote}
        </Alert>
      )}
    </PreviewSummary>
  );

  return (
    <>
      <PreviewModal
        opened={Boolean(letterId)}
        onClose={onClose}
        title={data ? `Letter ${data.referenceNumber}` : "Letter"}
        description={
          data
            ? `${data.student.name} · ${data.application.applicationNumber} · ${data.program.name}`
            : "Loading the letter..."
        }
        toolbar={toolbar}
        variant="frame"
      >
        {/* The PDF itself, as the student gets it: letterhead, logo, colours and layout. */}
        {letter.isLoading || pdf.isLoading ? (
          <Skeleton h={480} radius={0} />
        ) : letter.error || !data ? (
          <ErrorState
            error={letter.error}
            title="Could not load the letter"
            onRetry={() => letter.refetch()}
          />
        ) : pdf.error || !pdf.data ? (
          <ErrorState error={pdf.error} title="Could not load the PDF" onRetry={() => pdf.refetch()} />
        ) : (
          <PdfFrame url={pdf.data.url} title={`${data.referenceNumber} PDF`} />
        )}
      </PreviewModal>
      <SendEmailForm letter={sending ? (data ?? null) : null} onClose={() => setSending(false)} />
      <LetterReviewForm
        letter={reviewing ? (data ?? null) : null}
        action={reviewing ?? "approve"}
        onClose={() => setReviewing(null)}
      />
    </>
  );
}
