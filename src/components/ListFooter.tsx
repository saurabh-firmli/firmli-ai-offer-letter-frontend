import { useEffect } from "react";
import { Group, Pagination, Text } from "@mantine/core";
import { cssVar } from "../theme";
import { IPage } from "../types";

/**
 * The footer of every paginated list: "Showing 21–40 of 57" and the pages. When the list shrinks
 * (a filter, a delete) and the page no longer exists, it goes back to the last one.
 */
export default function ListFooter({
  data,
  page,
  onChange,
}: {
  data: IPage<unknown> | undefined;
  page: number;
  onChange: (page: number) => void;
}) {
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  useEffect(() => {
    if (data && page > totalPages) onChange(totalPages);
  }, [data, page, totalPages, onChange]);

  if (!data || data.total === 0) return null;
  const first = (data.page - 1) * data.limit;
  return (
    <Group justify="space-between" p="md" style={{ borderTop: `1px solid ${cssVar("divider")}` }}>
      <Text size="sm" c="dimmed">
        Showing {first + 1}–{first + data.items.length} of {data.total}
      </Text>
      <Pagination total={totalPages} value={page} onChange={onChange} size="sm" />
    </Group>
  );
}
