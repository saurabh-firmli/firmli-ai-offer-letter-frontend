import { useState } from "react";
import {
  Badge,
  Button,
  Collapse,
  Group,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconEye,
  IconFileDescription,
  IconRefresh,
  IconSend,
  IconSparkles,
} from "@tabler/icons-react";
import { SectionCard } from "../components/Field";
import StatusDot from "../components/StatusDot";
import { confirmDanger } from "../components/confirm";
import { IApplication } from "../lib/applications";
import { useCan } from "../lib/auth";
import { emailSendStatusColors, useEmailStatusLabel } from "../lib/emails";
import errorHandler from "../lib/errors";
import {
  ILetter,
  letterStatusColors,
  openLetterPdf,
  useApplicationLetters,
  useGenerateLetter,
  useLetterStatusLabel,
  useLetterTypeLabel,
} from "../lib/letters";
import { formatDateTime } from "../lib/utils";
import { SendEmailForm } from "./EmailView";
import LetterView from "./LetterView";

// A letter goes with a decided application (offer / rejection) or one in manual review.
export const canHaveLetter = (app: Pick<IApplication, "status" | "outcome">) =>
  app.status === "manual_review" ||
  (app.status === "completed" && (app.outcome === "conditional_offer" || app.outcome === "rejection"));

/** One letter in the list: reference, status, type and when, with its two actions on the right. */
function LetterRow({ letter, onView }: { letter: ILetter; onView: () => void }) {
  const statusLabel = useLetterStatusLabel();
  const typeLabel = useLetterTypeLabel();
  return (
    // The actions wrap under the details when the card is narrow; the reference always shows in full.
    <Group justify="space-between" gap="sm">
      <div>
        <Group gap={8} wrap="nowrap">
          <Text size="sm" fw={600} ff="monospace">
            {letter.referenceNumber}
          </Text>
          <Badge size="sm" variant="light" color={letterStatusColors[letter.status]}>
            {statusLabel(letter.status)}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {typeLabel(letter.letterType)} · {formatDateTime(letter.createdAt)}
          {letter.generatedBy ? ` · ${letter.generatedBy.name}` : ""}
        </Text>
      </div>
      <Group gap="xs" wrap="nowrap">
        <Button size="xs" variant="secondary" leftSection={<IconEye size={14} />} onClick={onView}>
          View
        </Button>
        <Button
          size="xs"
          variant="secondary"
          leftSection={<IconDownload size={14} />}
          onClick={() => openLetterPdf(letter)}
        >
          Download PDF
        </Button>
      </Group>
    </Group>
  );
}

/**
 * Generate Letter for an application: asks first when it replaces the current letter (which may then
 * need approval again), and toasts the result. onDone gets the new letter (e.g. to open it).
 */
export function useGenerateLetterAction() {
  const generate = useGenerateLetter();
  const start = (
    application: Pick<IApplication, "id" | "applicationNumber">,
    current: { referenceNumber: string } | null,
    onDone?: (letter: ILetter) => void
  ) => {
    const run = () =>
      generate.mutate(application.id, {
        onSuccess: (letter) => {
          notifications.show({
            color: "green",
            title: letter.status === "approved" ? "Letter generated and approved" : "Letter generated",
            message: `${letter.referenceNumber} · ${letter.student.name}${letter.status === "pending_approval" ? " · waiting for approval" : ""}`,
          });
          onDone?.(letter);
        },
        // 409: no template on the program, a draft template, or an undecided application.
        onError: (error) =>
          errorHandler(error, `Could not generate the letter for ${application.applicationNumber}`),
      });
    if (!current) return run();
    confirmDanger({
      title: "Generate the letter again?",
      message: (
        <>
          <b>{current.referenceNumber}</b> is replaced by a new version, which may need approval again.
        </>
      ),
      confirmLabel: "Generate Again",
      onConfirm: run,
    });
  };
  return { start, isPending: generate.isPending };
}

/**
 * The application's letter: the current one (the newest not replaced), Generate Letter, and the
 * earlier ones. Needs Letters read; generating also needs Letters create and Applications create.
 */
export default function ApplicationLetters({ application }: { application: IApplication }) {
  const can = useCan();
  const letters = useApplicationLetters(application.id);
  const generate = useGenerateLetterAction();
  const [viewing, setViewing] = useState<number | null>(null);
  const [sending, setSending] = useState<ILetter | null>(null);
  const emailStatusLabel = useEmailStatusLabel();
  const [historyOpened, history] = useDisclosure(false);

  const current = (letters.data ?? []).find(({ status }) => status !== "superseded");
  const earlier = (letters.data ?? []).filter((letter) => letter !== current);
  const mayGenerate = can("letters", "create") && can("applications", "create") && canHaveLetter(application);
  const maySend = current?.status === "approved" && can("communications", "create");

  // Generating again replaces the current letter; the hook asks first. The new letter opens.
  const onGenerate = () => generate.start(application, current ?? null, (letter) => setViewing(letter.id));

  return (
    <SectionCard
      title="Letter"
      style={{ height: "100%" }}
      action={
        mayGenerate && (
          <Button
            size="xs"
            variant={current ? "secondary" : "filled"}
            leftSection={current ? <IconRefresh size={14} /> : <IconSparkles size={14} />}
            onClick={onGenerate}
            loading={generate.isPending}
          >
            {current ? "Generate Again" : "Generate Letter"}
          </Button>
        )
      }
    >
      {letters.isLoading ? (
        <Stack gap="xs">
          <Skeleton h={14} w="50%" />
          <Skeleton h={12} w="70%" />
        </Stack>
      ) : current ? (
        <Stack gap="sm">
          <LetterRow letter={current} onView={() => setViewing(current.id)} />
          {/* Its email: how it went, and Send on the same line. */}
          {(current.email || maySend) && (
            <Group
              justify="space-between"
              gap="sm"
              pt="sm"
              style={{ borderTop: "1px solid var(--firmli-border-lighter)" }}
            >
              {current.email ? (
                <Group gap={6} wrap="nowrap">
                  <StatusDot color={emailSendStatusColors[current.email.status]} />
                  <Text size="xs" c="dimmed">
                    Email: {emailStatusLabel(current.email.status)}
                    {current.email.sentAt ? ` · ${formatDateTime(current.email.sentAt)}` : ""}
                  </Text>
                </Group>
              ) : (
                <Text size="xs" c="dimmed">
                  Not emailed to the student yet.
                </Text>
              )}
              {maySend && (
                <Button
                  size="xs"
                  variant={current.email ? "secondary" : "filled"}
                  leftSection={<IconSend size={14} />}
                  onClick={() => setSending(current)}
                >
                  {current.email ? "Send Email Again" : "Send Email to Student"}
                </Button>
              )}
            </Group>
          )}
          {current.status === "rejected" && current.reviewNote && (
            <Text size="xs" c="red">
              Rejected: {current.reviewNote}
            </Text>
          )}
        </Stack>
      ) : (
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={32} radius="md" variant="light" color="gray">
            <IconFileDescription size={18} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {canHaveLetter(application)
              ? "No letter yet. Generate it from the program's letter template."
              : "A letter can be generated once the application is decided or in manual review."}
          </Text>
        </Group>
      )}

      {earlier.length > 0 && (
        <>
          <UnstyledButton onClick={history.toggle} mt="md">
            <Group gap={4}>
              <Text size="xs" c="dimmed" fw={500}>
                {historyOpened ? "Hide" : "Show"} earlier letters ({earlier.length})
              </Text>
              {historyOpened ? (
                <IconChevronUp size={14} color="var(--mantine-color-dimmed)" />
              ) : (
                <IconChevronDown size={14} color="var(--mantine-color-dimmed)" />
              )}
            </Group>
          </UnstyledButton>
          <Collapse in={historyOpened}>
            <Stack gap="sm" mt="sm" pt="sm" style={{ borderTop: "1px solid var(--firmli-border-lighter)" }}>
              {earlier.map((letter) => (
                <LetterRow key={letter.id} letter={letter} onView={() => setViewing(letter.id)} />
              ))}
            </Stack>
          </Collapse>
        </>
      )}

      <LetterView letterId={viewing} onClose={() => setViewing(null)} />
      <SendEmailForm letter={sending} onClose={() => setSending(null)} />
    </SectionCard>
  );
}
