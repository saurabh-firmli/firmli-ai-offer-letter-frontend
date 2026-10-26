import { Button, Text } from "@mantine/core";
import { IconRefresh, IconShieldCheck } from "@tabler/icons-react";
import { useIsFetching } from "@tanstack/react-query";
import { APP_NAME, APP_TAGLINE } from "../config";
import { TErrorKind, describeError } from "../lib/errors";
import { ErrorIllustration, OfflineIllustration } from "./Illustrations";
import StatusScreen from "./StatusScreen";
import classes from "./AppLoader.module.css";

// The tag over the title says what went wrong; no answer at all gets the cut-link drawing.
const EYEBROW: Record<TErrorKind, string> = {
  offline: "No connection",
  timeout: "Server too slow",
  server: "Server error",
  forbidden: "Not allowed",
  notFound: "Not found",
  other: "Something went wrong",
};

/** The user couldn't be loaded: the same full screen as the error page and 404, with Try Again. */
function StartError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { kind, message, requestId } = describeError(error);
  const retrying = useIsFetching({ queryKey: ["me"] }) > 0;

  return (
    <StatusScreen
      illustration={
        kind === "offline" || kind === "timeout" ? <OfflineIllustration /> : <ErrorIllustration />
      }
      eyebrow={EYEBROW[kind]}
      title="Couldn't load your workspace"
      message={message}
      actions={
        onRetry && (
          <Button leftSection={<IconRefresh size={16} />} onClick={onRetry} loading={retrying}>
            Try Again
          </Button>
        )
      }
    >
      {requestId && (
        <Text size="xs" c="dimmed" ta="center">
          Request ID:{" "}
          <Text span ff="monospace" inherit>
            {requestId}
          </Text>
        </Text>
      )}
    </StatusScreen>
  );
}

/**
 * The whole app starting (the logged in user loading): a branded splash, not a skeleton, since there
 * is no menu or page yet to shape one after. Pages inside the app still load with skeletons.
 * With `error` (the user couldn't be loaded: server down, offline) it is the app's full-screen status
 * page (components/StatusScreen, like the error page and 404), with Try Again.
 */
export default function AppLoader({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  if (error) return <StartError error={error} onRetry={onRetry} />;

  return (
    <div className={classes.screen} role="status" aria-live="polite" aria-label={`Loading ${APP_NAME}`}>
      <div className={classes.content}>
        <div className={classes.mark}>
          <div className={classes.logo}>
            <IconShieldCheck size={32} />
          </div>
        </div>
        <Text fw={700} fz={22} c="var(--firmli-text-heading)">
          {APP_NAME}
        </Text>
        <Text size="sm" c="dimmed">
          {APP_TAGLINE}
        </Text>
        <div className={classes.track}>
          <div className={classes.bar} />
        </div>
        <Text size="xs" c="dimmed" mt="sm">
          Loading your workspace…
        </Text>
      </div>
    </div>
  );
}
