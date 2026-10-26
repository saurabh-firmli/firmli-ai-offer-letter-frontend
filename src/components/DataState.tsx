import { ReactNode } from "react";
import { Stack, Text } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import ErrorState from "./ErrorState";
import { TableSkeleton } from "./Skeletons";

interface IDataStateProps {
  isLoading: boolean;
  error: unknown; // the query's error, null when there is none
  isEmpty: boolean;
  emptyTitle: string;
  emptyText?: string;
  emptyIcon?: typeof IconFolderOpen;
  errorTitle: string;
  skeleton?: ReactNode; // what shows while loading; a table by default
  children: ReactNode;
}

/** Loading, error and empty states of a list; renders `children` once there is data. */
export default function DataState({
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyText,
  emptyIcon: Icon = IconFolderOpen,
  errorTitle,
  skeleton = <TableSkeleton />,
  children,
}: IDataStateProps) {
  if (isLoading) return skeleton;

  // What went wrong in plain words, with Try Again.
  if (error) return <ErrorState error={error} title={errorTitle} />;

  if (isEmpty) {
    return (
      <Stack align="center" gap="xs" py={60}>
        <Icon size={40} stroke={1.4} color="var(--mantine-color-gray-5)" />
        <Text fw={600}>{emptyTitle}</Text>
        {emptyText && (
          <Text c="dimmed" size="sm">
            {emptyText}
          </Text>
        )}
      </Stack>
    );
  }

  return children;
}
