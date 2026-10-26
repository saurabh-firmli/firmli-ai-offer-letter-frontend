import { ActionIcon, Button, CopyButton, Group, Stack, Text, ThemeIcon, Tooltip } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconCopy,
  IconLock,
  IconRefresh,
  IconSearch,
  IconServerOff,
  IconWifiOff,
} from "@tabler/icons-react";
import { useIsFetching } from "@tanstack/react-query";
import { TErrorKind, describeError } from "../lib/errors";
import { queryClient } from "../lib/queryClient";

const LOOK: Record<TErrorKind, { icon: typeof IconWifiOff; color: string }> = {
  offline: { icon: IconWifiOff, color: "orange" },
  timeout: { icon: IconClock, color: "orange" },
  server: { icon: IconServerOff, color: "red" },
  forbidden: { icon: IconLock, color: "gray" },
  notFound: { icon: IconSearch, color: "gray" },
  other: { icon: IconAlertTriangle, color: "red" },
};

/**
 * Something failed to load: what happened in plain words, Try Again, and for a server error the
 * request id to send to support. Try Again reloads what the page shows (every active query).
 */
export default function ErrorState({
  error,
  title,
  onRetry,
  compact = false,
}: {
  error: unknown;
  title: string; // e.g. "Could not load applications"
  onRetry?: () => void;
  compact?: boolean; // under something else (the app start screen): less room around it
}) {
  const { kind, message, requestId } = describeError(error);
  const { icon: Icon, color } = LOOK[kind];
  const fetching = useIsFetching() > 0;
  // A missing permission or record won't change by trying again.
  const retryable = kind !== "forbidden" && kind !== "notFound";
  const retry = onRetry ?? (() => void queryClient.refetchQueries({ type: "active" }));

  return (
    <Stack align="center" gap="xs" py={compact ? 0 : 48} mt={compact ? "xl" : 0} px="md" role="alert">
      <ThemeIcon size={compact ? 40 : 56} radius="xl" variant="light" color={color}>
        <Icon size={compact ? 22 : 28} stroke={1.6} />
      </ThemeIcon>
      <Text fw={600} mt="xs">
        {title}
      </Text>
      <Text size="sm" c="dimmed" ta="center" maw={440}>
        {message}
      </Text>
      {retryable && (
        <Button
          variant="secondary"
          leftSection={<IconRefresh size={16} />}
          onClick={retry}
          loading={fetching}
          mt="sm"
        >
          Try Again
        </Button>
      )}
      {requestId && (
        <Group gap={4} mt={4}>
          <Text size="xs" c="dimmed">
            Request ID:{" "}
            <Text span ff="monospace" inherit>
              {requestId}
            </Text>
          </Text>
          <CopyButton value={requestId}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Copied" : "Copy"}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={copy}
                  aria-label="Copy request ID"
                >
                  {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      )}
    </Stack>
  );
}
