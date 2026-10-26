import { ReactNode } from "react";
import { Anchor, Breadcrumbs, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { RO_DASHBOARD } from "../routes";

interface IPageHeaderProps {
  title: string;
  badge?: ReactNode; // next to the title, e.g. a record's status
  description?: ReactNode;
  action?: ReactNode; // e.g. the "New ..." button
  withBreadcrumbs?: boolean;
  parent?: { label: string; to: string }; // a page under a list, e.g. one application under Applications
}

/** Title row of a page: "Dashboard › (Parent ›) Title" breadcrumbs, title, optional description and action. */
export default function PageHeader({
  title,
  badge,
  description,
  action,
  withBreadcrumbs = true,
  parent,
}: IPageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end">
      <Stack gap={6}>
        {withBreadcrumbs && (
          <Breadcrumbs separator="›" fz="sm">
            <Anchor component={Link} to={RO_DASHBOARD} c="dimmed" fz="sm">
              Dashboard
            </Anchor>
            {parent && (
              <Anchor component={Link} to={parent.to} c="dimmed" fz="sm">
                {parent.label}
              </Anchor>
            )}
            <Text fz="sm" fw={500}>
              {title}
            </Text>
          </Breadcrumbs>
        )}
        <Group gap="sm">
          <Title order={1} fz={26}>
            {title}
          </Title>
          {badge}
        </Group>
        {description && <Text c="dimmed">{description}</Text>}
      </Stack>
      {action}
    </Group>
  );
}
