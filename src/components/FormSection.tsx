import { ReactNode } from "react";
import { Group, Stack } from "@mantine/core";
import SectionTitle from "./SectionTitle";
import classes from "./FormSection.module.css";

interface IFormSectionProps {
  title: string;
  action?: ReactNode; // shown at the right of the title, e.g. "Insert variable"
  children: ReactNode;
}

/** A group of fields inside a form drawer, with a divider line between sections. */
export default function FormSection({ title, action, children }: IFormSectionProps) {
  return (
    <Stack gap="md" className={classes.section}>
      <Group justify="space-between" wrap="nowrap" mih={action ? 30 : undefined}>
        <SectionTitle>{title}</SectionTitle>
        {action}
      </Group>
      {children}
    </Stack>
  );
}
