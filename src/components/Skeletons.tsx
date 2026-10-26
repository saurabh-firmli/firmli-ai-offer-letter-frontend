import { Box, Card, Grid, Group, SimpleGrid, Skeleton, Stack } from "@mantine/core";
import classes from "./Skeletons.module.css";

/*
 * Placeholders shaped like the content that is loading, used instead of a spinner everywhere content
 * loads (a spinner stays only inside buttons, for an action in progress).
 */

// Varied widths so rows don't look like one solid block.
const WIDTHS = ["70%", "55%", "80%", "45%", "65%"];

/** Rows of a table: a two-line first column (name + detail) and short cells. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Box aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, row) => (
        <Group key={row} className={classes.row} wrap="nowrap" gap="xl">
          <Stack gap={6} style={{ flex: 2 }}>
            <Skeleton h={12} w={WIDTHS[row % WIDTHS.length]} />
            <Skeleton h={10} w="35%" />
          </Stack>
          {Array.from({ length: columns - 1 }, (_, column) => (
            <Skeleton
              key={column}
              h={12}
              style={{ flex: 1 }}
              w={WIDTHS[(row + column + 1) % WIDTHS.length]}
            />
          ))}
        </Group>
      ))}
    </Box>
  );
}

/** Items of a list: a title and a short line under it (e.g. the eligibility sets). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Box aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, row) => (
        <Stack key={row} gap={8} className={classes.row}>
          <Skeleton h={12} w={WIDTHS[row % WIDTHS.length]} />
          <Skeleton h={10} w="40%" />
        </Stack>
      ))}
    </Box>
  );
}

/** A card with a heading, a line of detail and a row of buttons (e.g. an eligibility set's header). */
export function CardSkeleton() {
  return (
    <Stack gap="sm" aria-busy aria-label="Loading">
      <Skeleton h={20} w="40%" />
      <Skeleton h={10} w="60%" />
      <Group gap="xs" mt="md">
        <Skeleton h={36} w={190} radius="md" />
        <Skeleton h={36} w={130} radius="md" />
        <Skeleton h={36} w={150} radius="md" />
      </Group>
    </Stack>
  );
}

/** A form: labels and inputs, two to a row, then a larger text area. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  const field = (key: number) => (
    <Stack key={key} gap={6}>
      <Skeleton h={10} w={90} />
      <Skeleton h={36} radius="md" />
    </Stack>
  );
  return (
    <Stack gap="lg" aria-busy aria-label="Loading">
      <Skeleton h={10} w={120} />
      <SimpleGrid cols={{ base: 1, xs: 2 }}>{Array.from({ length: fields }, (_, i) => field(i))}</SimpleGrid>
      <Stack gap={6}>
        <Skeleton h={10} w={90} />
        <Skeleton h={140} radius="md" />
      </Stack>
    </Stack>
  );
}

/** A whole list page: breadcrumbs, title, the "New" button and a table card. */
export function PageSkeleton() {
  return (
    <Stack p={{ base: "md", sm: 32 }} gap="lg" aria-busy aria-label="Loading">
      <Group justify="space-between" align="flex-end">
        <Stack gap={10}>
          <Skeleton h={10} w={140} />
          <Skeleton h={24} w={220} />
        </Stack>
        <Skeleton h={36} w={130} radius="md" />
      </Group>
      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="md">
          <Skeleton h={36} radius="md" style={{ flex: 1 }} />
          <Skeleton h={36} w={170} radius="md" />
        </Group>
        <TableSkeleton />
      </Card>
    </Stack>
  );
}

/** A stats page (Dashboard, AI Usage): a row of number cards, then two cards side by side. */
export function StatsPageSkeleton() {
  return (
    <>
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: "sm", sm: "lg" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} withBorder radius="lg" padding="lg" shadow="xs">
            <Stack gap="sm">
              <Skeleton h={36} w={36} radius="md" />
              <Skeleton h={28} w="40%" />
              <Skeleton h={10} w="70%" />
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <Grid gutter="lg">
        {[8, 4].map((span) => (
          <Grid.Col key={span} span={{ base: 12, md: span }}>
            <Card withBorder radius="lg" padding="lg" shadow="xs">
              <Stack gap="md">
                <Skeleton h={16} w="30%" />
                <Skeleton h={10} w="50%" />
                <Skeleton h={120} radius="md" />
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </>
  );
}
