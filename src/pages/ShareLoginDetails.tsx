import { ReactNode } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  CopyButton,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconCopy, IconEye, IconEyeOff, IconInfoCircle, IconMail } from "@tabler/icons-react";
import errorHandler from "../lib/errors";
import { useSendCredentials } from "../lib/users";
import { RO_LOGIN } from "../routes";

export interface ILoginDetails {
  id: number; // the user, for Send by Email
  name: string;
  email: string;
  password: string;
  company?: string; // the tenant, for the message
  tenantId?: number; // another tenant's user (Platform Admin): emailed through the platform API
}

/** The login page link, with the email filled in on that page (Login reads ?email=). */
const loginUrl = (email: string) => `${window.location.origin}${RO_LOGIN}?email=${encodeURIComponent(email)}`;

/** The message to paste in chat or send by email. */
const shareMessage = ({ name, email, password, company }: ILoginDetails) =>
  [
    `Hi ${name},`,
    "",
    `Your account${company ? ` at ${company}` : ""} is ready. Log in here:`,
    loginUrl(email),
    "",
    `Email: ${email}`,
    `Temporary password: ${password}`,
    "",
    "Please keep this password to yourself.",
  ].join("\n");

function CopyIcon({ value, label }: { value: string; label: string }) {
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}>
          <ActionIcon
            variant="subtle"
            color={copied ? "green" : "gray"}
            onClick={copy}
            aria-label={`Copy ${label}`}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

function Row({
  label,
  value,
  shown,
  extra,
}: {
  label: string;
  value: string;
  shown?: string;
  extra?: ReactNode;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" px="md" py="sm">
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="sm" fw={500} truncate ff={label === "Password" ? "monospace" : undefined}>
          {shown ?? value}
        </Text>
      </div>
      <Group gap={2} wrap="nowrap">
        {extra}
        <CopyIcon value={value} label={label} />
      </Group>
    </Group>
  );
}

/**
 * Shown right after a user is created: the login page, email and password to pass on. The API never
 * returns a password, so this is the only time it can be seen.
 */
export default function ShareLoginDetails({
  details,
  onDone,
}: {
  details: ILoginDetails;
  onDone: () => void;
}) {
  const [passwordVisible, { toggle }] = useDisclosure();
  const message = shareMessage(details);
  const send = useSendCredentials();
  const sendByEmail = () =>
    send.mutate(
      { id: details.id, password: details.password, tenantId: details.tenantId },
      {
        onSuccess: ({ sentTo }) =>
          notifications.show({
            color: "green",
            title: "Email sent",
            message: `Login details sent to ${sentTo}`,
          }),
        // 503 when the backend has no mail server: Copy All still works.
        onError: (error) => errorHandler(error, "Could not send the email"),
      }
    );

  return (
    <Stack>
      <Paper withBorder radius="md">
        <Stack gap={0}>
          <Row label="Login Page" value={loginUrl(details.email)} />
          <Divider />
          <Row label="Email" value={details.email} />
          <Divider />
          <Row
            label="Password"
            value={details.password}
            shown={passwordVisible ? details.password : "•".repeat(Math.min(details.password.length, 12))}
            extra={
              <Tooltip label={passwordVisible ? "Hide" : "Show"}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={toggle}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </ActionIcon>
              </Tooltip>
            }
          />
        </Stack>
      </Paper>

      <Alert variant="light" color="orange" icon={<IconInfoCircle size={18} />}>
        The password is shown only now and can't be seen again. Share it before you close this.
      </Alert>

      <Group justify="space-between" gap="sm">
        <Group gap="sm">
          <CopyButton value={message}>
            {({ copied, copy }) => (
              <Button
                variant="secondary"
                leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                onClick={copy}
              >
                {copied ? "Copied" : "Copy All"}
              </Button>
            )}
          </CopyButton>
          {/* The backend emails it, from its sender address with the institution's contact email as reply-to. */}
          <Button
            variant="secondary"
            leftSection={<IconMail size={16} />}
            onClick={sendByEmail}
            loading={send.isPending}
          >
            Send by Email
          </Button>
        </Group>
        <Button onClick={onDone}>Done</Button>
      </Group>
    </Stack>
  );
}
