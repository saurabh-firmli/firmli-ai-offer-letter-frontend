import { Anchor, Button, Code, Collapse, CopyButton, Group, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHome, IconRefresh } from "@tabler/icons-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { ErrorIllustration, UpdateIllustration } from "../components/Illustrations";
import StatusScreen from "../components/StatusScreen";
import classes from "../components/StatusScreen.module.css";
import { RO_DASHBOARD } from "../routes";
import NotFound from "./NotFound";

// After a deploy, an open tab asks for page chunks that no longer exist; a reload fixes it.
const isStaleChunk = (message: string) =>
  /dynamically imported module|Importing a module script failed|Loading chunk/i.test(message);

// Rendered by the router when a route throws while loading or rendering.
export default function ErrorPage() {
  const error = useRouteError();
  const [detailsOpened, details] = useDisclosure();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  // A full page load (not a router link), so the broken page's state is dropped.
  const reload = (
    <Button leftSection={<IconRefresh size={16} />} onClick={() => window.location.reload()}>
      Reload Page
    </Button>
  );

  if (isStaleChunk(message)) {
    return (
      <StatusScreen
        illustration={<UpdateIllustration />}
        eyebrow="Update available"
        title="A new version is ready"
        message="The app was updated while this tab was open. Reload to get the latest version."
        actions={reload}
      />
    );
  }

  return (
    <StatusScreen
      illustration={<ErrorIllustration />}
      eyebrow="Unexpected error"
      title="Oops! Something went wrong"
      message="We couldn't load this page. Reload to try again; if it keeps happening, send the error details below to the Firmli team."
      actions={
        <>
          {reload}
          <Button component="a" href={RO_DASHBOARD} variant="secondary" leftSection={<IconHome size={16} />}>
            Go to Dashboard
          </Button>
        </>
      }
    >
      <Stack gap="xs" w="100%" align="center">
        <Anchor component="button" type="button" size="sm" c="dimmed" onClick={details.toggle}>
          {detailsOpened ? "Hide error details" : "Show error details"}
        </Anchor>
        <Collapse in={detailsOpened} w="100%">
          <Stack gap="xs">
            <Code block className={classes.details}>
              {message}
            </Code>
            <Group justify="flex-end">
              <CopyButton value={message}>
                {({ copied, copy }) => (
                  <Button size="compact-xs" variant="subtle" onClick={copy}>
                    {copied ? "Copied" : "Copy details"}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Stack>
        </Collapse>
      </Stack>
    </StatusScreen>
  );
}
