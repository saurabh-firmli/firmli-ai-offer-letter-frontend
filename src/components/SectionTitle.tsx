import { ReactNode } from "react";
import { Text } from "@mantine/core";

/** Small uppercase heading that groups fields inside a form ("PROGRAM DETAILS", "LOCATION"). */
export default function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" fw={600} tt="uppercase" c="dimmed" lts="0.06em">
      {children}
    </Text>
  );
}
