import { Button, Text } from "@mantine/core";
import { IconArrowLeft, IconList, IconRefresh } from "@tabler/icons-react";
import { useIsFetching } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { describeError } from "../lib/errors";
import { queryClient } from "../lib/queryClient";
import {
  ErrorIllustration,
  LockedIllustration,
  NotFoundIllustration,
  OfflineIllustration,
} from "./Illustrations";
import StatusScreen from "./StatusScreen";

interface IRecordUnavailableProps {
  error: unknown;
  noun: string; // what the page shows, lowercase: "application", "eligibility set"
  list: { label: string; to: string }; // the list it belongs to, e.g. Applications
}

/**
 * A detail page whose record can't be shown, on the same screen as 404 (inside the app). Not found:
 * the map and why that happens. No permission: the padlock. Anything else (offline, server error):
 * what happened, with Try Again. Always the way back to the list.
 */
export default function RecordUnavailable({ error, noun, list }: IRecordUnavailableProps) {
  const navigate = useNavigate();
  const { kind, message, requestId } = describeError(error);
  const fetching = useIsFetching() > 0;
  const canGoBack = window.history.length > 1;
  const retryable = kind !== "notFound" && kind !== "forbidden";

  const actions = (
    <>
      {retryable && (
        <Button
          leftSection={<IconRefresh size={16} />}
          loading={fetching}
          onClick={() => void queryClient.refetchQueries({ type: "active" })}
        >
          Try Again
        </Button>
      )}
      <Button
        component={Link}
        to={list.to}
        variant={retryable ? "secondary" : "filled"}
        leftSection={<IconList size={16} />}
      >
        Back to {list.label}
      </Button>
      {canGoBack && (
        <Button variant="tertiary" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
          Go Back
        </Button>
      )}
    </>
  );

  if (kind === "notFound")
    return (
      <StatusScreen
        inline
        illustration={<NotFoundIllustration />}
        eyebrow="Not found"
        title={`This ${noun} isn't here`}
        message="It may have been deleted, the link may be wrong, or it belongs to another institution."
        actions={actions}
      />
    );

  if (kind === "forbidden")
    return (
      <StatusScreen
        inline
        illustration={<LockedIllustration />}
        eyebrow="No access"
        title={`You can't open this ${noun}`}
        message="Your role doesn't allow it. Ask your institution's Super Admin if you need access."
        actions={actions}
      />
    );

  return (
    <StatusScreen
      inline
      illustration={
        kind === "offline" || kind === "timeout" ? <OfflineIllustration /> : <ErrorIllustration />
      }
      eyebrow={
        kind === "offline" ? "No connection" : kind === "timeout" ? "Server too slow" : "Something went wrong"
      }
      title={`Could not load the ${noun}`}
      message={message}
      actions={actions}
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
