import { Button, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { RO_HOME } from "../routes";

export default function NotFound() {
  return (
    <Stack align="center" justify="center" h="100vh" gap="sm">
      <Title order={1}>404</Title>
      <Text c="dimmed">The page you are looking for does not exist.</Text>
      <Button component={Link} to={RO_HOME}>
        Go home
      </Button>
    </Stack>
  );
}
