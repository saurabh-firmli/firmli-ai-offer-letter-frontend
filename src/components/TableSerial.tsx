import { Table } from "@mantine/core";

/*
 * The "#" column, first in every list table. On a paged list the number carries on across pages
 * (page 2 of 20 starts at 21): pass the offset, (page - 1) * limit.
 */

export function SerialHead() {
  return <Table.Th w={56}>#</Table.Th>;
}

export function SerialCell({ index, offset = 0 }: { index: number; offset?: number }) {
  return (
    <Table.Td c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
      {offset + index + 1}
    </Table.Td>
  );
}
