import { useState } from "react";
import { Badge, Group, Skeleton, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconMail, IconRefresh } from "@tabler/icons-react";
import { SectionCard } from "../components/Field";
import RowActions from "../components/RowActions";
import { useCan } from "../lib/auth";
import {
  canRetryEmail,
  emailSendStatusColors,
  useApplicationEmails,
  useEmailStatusLabel,
  useEmailTypeLabel,
} from "../lib/emails";
import { formatDateTime } from "../lib/utils";
import EmailView, { attemptsText, useRetry } from "./EmailView";

/**
 * The emails sent to the application's student (letters and document requests), newest first.
 * Needs Communications read; a click opens the email as sent, and a failed one can be retried.
 */
export default function ApplicationEmails({ applicationId }: { applicationId: number }) {
  const can = useCan();
  const emails = useApplicationEmails(applicationId);
  const statusLabel = useEmailStatusLabel();
  const typeLabel = useEmailTypeLabel();
  const retry = useRetry();
  const [viewing, setViewing] = useState<number | null>(null);
  const items = emails.data?.items ?? [];

  return (
    <SectionCard
      title={`Emails${emails.data?.total ? ` (${emails.data.total})` : ""}`}
      style={{ height: "100%" }}
    >
      {emails.isLoading ? (
        <Stack gap="xs">
          <Skeleton h={14} w="60%" />
          <Skeleton h={12} w="40%" />
        </Stack>
      ) : items.length ? (
        <Stack gap="sm">
          {items.map((email) => (
            <Group key={email.id} justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
              <UnstyledButton onClick={() => setViewing(email.id)} style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" fw={600} truncate>
                  {email.subject}
                </Text>
                <Group gap={6} wrap="nowrap" mt={2}>
                  <Badge size="xs" variant="light" color={emailSendStatusColors[email.status]}>
                    {statusLabel(email.status)}
                  </Badge>
                  <Tooltip label={email.lastError} disabled={!email.lastError} multiline maw={300}>
                    <Text size="xs" c="dimmed" truncate>
                      {typeLabel(email.emailType)} · {formatDateTime(email.sentAt ?? email.createdAt)}
                      {email.status !== "sent" ? ` · ${attemptsText(email)}` : ""}
                    </Text>
                  </Tooltip>
                </Group>
              </UnstyledButton>
              {can("communications", "update") && canRetryEmail(email.status) && (
                <RowActions
                  name={email.subject}
                  extra={[
                    {
                      label: "Retry Now",
                      icon: IconRefresh,
                      color: "orange",
                      onClick: () => retry.run(email),
                    },
                  ]}
                />
              )}
            </Group>
          ))}
        </Stack>
      ) : (
        <Group gap="sm" wrap="nowrap">
          <IconMail size={18} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">
            No emails to the student yet.
          </Text>
        </Group>
      )}

      <EmailView emailId={viewing} onClose={() => setViewing(null)} />
    </SectionCard>
  );
}
