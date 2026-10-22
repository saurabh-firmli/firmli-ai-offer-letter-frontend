import { Button, Stack, Text, Title } from "@mantine/core";
import { isRouteErrorResponse, useRouteError } from "react-router";

// Rendered by the router when a route throws while loading or rendering.
export default function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <Stack align="center" justify="center" h="100vh" gap="sm">
      <Title order={2}>Something went wrong</Title>
      <Text c="dimmed">{message}</Text>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </Stack>
  );
}
