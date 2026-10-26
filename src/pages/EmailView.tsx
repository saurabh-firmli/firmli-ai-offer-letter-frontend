import { useEffect, useState } from "react";
import { Alert, Badge, Button, Group, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconInfoCircle,
  IconMail,
  IconClock,
  IconMailCheck,
  IconMailFast,
  IconMailX,
  IconRefresh,
  IconSend,
  IconTemplate,
} from "@tabler/icons-react";
import ErrorState from "../components/ErrorState";
import { Field } from "../components/Field";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import SearchableSelect from "../components/SearchableSelect";
import {
  AttachmentChip,
  EmailFrame,
  PreviewModal,
  PreviewSummary,
  SafeHtml,
} from "../components/TemplatePreview";
import { useCan } from "../lib/auth";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import {
  IEmail,
  TEmailSendStatus,
  canRetryEmail,
  emailSendStatusColors,
  useEmail,
  useEmailStatusLabel,
  useEmailTypeLabel,
  useRetryEmail,
  useSendLetter,
} from "../lib/emails";
import errorHandler from "../lib/errors";
import { applyFormErrorMessages } from "../lib/forms";
import { ILetter, openLetterPdf, useLetterTypeLabel } from "../lib/letters";
import { formatDateTime } from "../lib/utils";

/** After a send or a retry: green when it went, a warning with the API's message when it didn't. */
const RESULT = {
  sent: { color: "green", title: "Email sent" },
  failed: { color: "red", title: "Email could not be sent" },
  pending: { color: "orange", title: "Email not sent yet" }, // sending or retrying
};

export function showEmailResult({ email, message }: { email: IEmail; message: string }) {
  const result = email.status === "sent" || email.status === "failed" ? RESULT[email.status] : RESULT.pending;
  notifications.show({
    ...result,
    message: `${email.recipient} · ${email.status === "sent" ? email.subject : message}`,
  });
}

/** Retry a failed or waiting email now, with the result as a toast. */
export function useRetry() {
  const retry = useRetryEmail();
  return {
    isPending: retry.isPending,
    run: (email: IEmail) =>
      retry.mutate(email.id, {
        onSuccess: showEmailResult,
        onError: (error) => errorHandler(error, `Could not retry the email to ${email.recipient}`),
      }),
  };
}

/** "3 of 4 tries · next at 25 Oct, 2:45 PM" */
export const attemptsText = (email: IEmail) =>
  `${email.attempts} of ${email.maxAttempts} ${email.maxAttempts === 1 ? "try" : "tries"}${
    email.status === "retrying" && email.nextRetryAt ? ` · next ${formatDateTime(email.nextRetryAt)}` : ""
  }`;

/**
 * Send Email: an approved letter to the student. The program's email template for the letter's
 * type is used unless another is picked; a Manual Review letter has none on the program, so it needs one.
 */
export function SendEmailForm({ letter, onClose }: { letter: ILetter | null; onClose: () => void }) {
  const send = useSendLetter();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsTemplate = letter?.letterType === "manual_review";
  const emailTypeLabel = useEmailTypeLabel();
  const letterTypeLabel = useLetterTypeLabel();
  const templates = useDropdown(
    "email-templates",
    { emailType: letter?.letterType ?? "", status: "published" },
    Boolean(letter)
  );

  useEffect(() => {
    if (!letter) return;
    setTemplateId(null);
    setError(null);
  }, [letter]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!letter) return;
    if (needsTemplate && !templateId) {
      setError("Pick the email to send with a Manual Review letter");
      return;
    }
    send.mutate(
      { letterId: letter.id, templateId: templateId ? Number(templateId) : undefined },
      {
        onSuccess: (result) => {
          showEmailResult(result);
          onClose();
        },
        // 409: no email template on the program, a draft one, or a letter that isn't approved.
        onError: (failure) =>
          applyFormErrorMessages(failure, { templateId: setError }) ||
          errorHandler(failure, `Could not email ${letter.referenceNumber}`),
      }
    );
  };

  const typeLabel = letter ? emailTypeLabel(letter.letterType) : "";

  return (
    <FormModal
      opened={Boolean(letter)}
      onClose={onClose}
      title="Send Email"
      description={letter ? `${letter.referenceNumber} · ${letter.student.name}` : undefined}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <SimpleGrid cols={2} spacing="md">
            <Field label="To">{letter?.student.email}</Field>
            <Field label="Letter">{letter && letterTypeLabel(letter.letterType)}</Field>
          </SimpleGrid>
          <SearchableSelect
            label="Email Template"
            withAsterisk={needsTemplate}
            placeholder={
              templates.isLoading
                ? "Loading..."
                : needsTemplate
                  ? `Select a ${typeLabel} email`
                  : "The program's email template"
            }
            searchPlaceholder="Search templates..."
            nothingFoundMessage={`No published ${typeLabel} email template`}
            leftSection={<IconMail size={16} />}
            data={toSelectData(templates.data)}
            value={templateId}
            onChange={(value) => {
              setTemplateId(value);
              setError(null);
            }}
            clearable={!needsTemplate}
            description={
              needsTemplate
                ? "A Manual Review letter has no email on the program: pick one."
                : "Leave it empty to use the program's Offer / Rejection email."
            }
            error={error}
          />
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
            The letter&apos;s PDF is attached when the template has Attach PDF Letter on. A failed send is
            retried by itself (Max Retry Attempts in Settings).
          </Alert>
          <FormActions onCancel={onClose} submitLabel="Send Email" loading={send.isPending} />
        </Stack>
      </form>
    </FormModal>
  );
}

/** The icon of an email's state: in the email's summary and a letter's Email step. */
export const emailStatusIcons: Record<TEmailSendStatus, typeof IconMail> = {
  sending: IconMailFast,
  sent: IconMailCheck,
  retrying: IconClock,
  failed: IconMailX,
};

const tries = (count: number) => `${count} ${count === 1 ? "try" : "tries"}`;

/** How the sending went, in words: "Sent on the first try", "Failed after 4 tries". */
const deliveryText = (email: IEmail) => {
  switch (email.status) {
    case "sent":
      return email.attempts <= 1
        ? "Sent on the first try"
        : `Sent on try ${email.attempts} of ${email.maxAttempts}`;
    case "failed":
      return `Failed after ${tries(email.attempts)}`;
    case "retrying":
      return `Try ${email.attempts} of ${email.maxAttempts} failed`;
    default:
      return "Sending now";
  }
};

/** One email as it was sent: who to, its status and tries, and its body (sanitized). Retry when it failed. */
export default function EmailView({ emailId, onClose }: { emailId: number | null; onClose: () => void }) {
  const can = useCan();
  const email = useEmail(emailId);
  const statusLabel = useEmailStatusLabel();
  const typeLabel = useEmailTypeLabel();
  const retry = useRetry();
  const data = email.data;
  // A whole document (the branded layout) brings its own page: shown in a frame. An older email that is
  // only body HTML goes in our mail card instead.
  const isDocument = Boolean(data?.bodyHtml && /<(html|body)[s>]/i.test(data.bodyHtml));

  const toolbar = data && (
    <PreviewSummary
      badges={
        <>
          <Badge variant="light" color={emailSendStatusColors[data.status]}>
            {statusLabel(data.status)}
          </Badge>
          <Badge variant="outline" color="gray">
            {typeLabel(data.emailType)}
          </Badge>
          {data.template && (
            <Group gap={4} wrap="nowrap">
              <IconTemplate size={14} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                {data.template.name}
              </Text>
            </Group>
          )}
        </>
      }
      actions={
        can("communications", "update") &&
        canRetryEmail(data.status) && (
          <Button
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={() => retry.run(data)}
            loading={retry.isPending}
          >
            Retry Now
          </Button>
        )
      }
      facts={[
        {
          icon: IconMail,
          label: "To",
          value: data.recipient,
          hint: [data.cc && `CC ${data.cc}`, data.bcc && `BCC ${data.bcc}`].filter(Boolean).join(" · "),
        },
        {
          icon: IconSend,
          label: data.sentAt ? "Sent" : "Created",
          value: formatDateTime(data.sentAt ?? data.createdAt),
          hint: data.sentBy ? `by ${data.sentBy.name}` : "Automatically",
        },
        {
          icon: emailStatusIcons[data.status] ?? IconMail,
          color: emailSendStatusColors[data.status],
          label: "Delivery",
          value: deliveryText(data),
          hint:
            data.status === "retrying" && data.nextRetryAt
              ? `Next try ${formatDateTime(data.nextRetryAt)}`
              : data.sender &&
                `via ${data.sender === "custom" ? "your email server" : "Firmli's email server"}`,
        },
      ]}
    >
      {data.lastError && (
        <Alert variant="light" color="red" icon={<IconAlertTriangle size={18} />} title="Last error">
          {data.lastError}
        </Alert>
      )}
    </PreviewSummary>
  );

  return (
    <PreviewModal
      opened={Boolean(emailId)}
      onClose={onClose}
      title={data ? data.subject : "Email"}
      description={
        data
          ? [data.application?.applicationNumber, data.letter?.referenceNumber].filter(Boolean).join(" · ") ||
            data.recipient
          : "Loading the email..."
      }
      toolbar={toolbar}
      variant={isDocument ? "frame" : "email"}
      footer={
        data?.attachLetter &&
        data.letter && (
          <AttachmentChip
            name={`${data.letter.referenceNumber}.pdf`}
            hint="The letter, as sent · click to open"
            onClick={() => openLetterPdf(data.letter!)}
          />
        )
      }
    >
      {email.isLoading ? (
        <Stack gap="sm">
          <Skeleton h={12} />
          <Skeleton h={12} />
          <Skeleton h={12} w="70%" />
        </Stack>
      ) : email.error || !data ? (
        <ErrorState error={email.error} title="Could not load the email" />
      ) : isDocument ? (
        <EmailFrame html={data.bodyHtml!} title={data.subject} />
      ) : data.bodyHtml ? (
        <SafeHtml html={data.bodyHtml} />
      ) : (
        <Text style={{ whiteSpace: "pre-wrap" }}>{data.bodyText}</Text>
      )}
    </PreviewModal>
  );
}
