import { ReactNode } from "react";
import { Stack, Text } from "@mantine/core";

interface IFormHeaderProps {
  title: string;
  description?: ReactNode;
}

/**
 * Title + one line under it, for every form modal and drawer (FormModal, ProgramForm).
 * Sets its own line heights: Mantine's Modal / Drawer title has line-height 1.
 */
export default function FormHeader({ title, description }: IFormHeaderProps) {
  return (
    <Stack gap={4}>
      <Text component="span" fz={20} fw={600} lh={1.3}>
        {title}
      </Text>
      {description && (
        <Text component="span" size="sm" fw={400} c="dimmed" lh={1.45}>
          {description}
        </Text>
      )}
    </Stack>
  );
}
