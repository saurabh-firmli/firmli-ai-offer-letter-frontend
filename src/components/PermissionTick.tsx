import { ThemeIcon } from "@mantine/core";
import { IconCheck, IconMinus } from "@tabler/icons-react";

/** One permission switch, read only: a green tick when allowed, a grey dash when not (Roles, My Profile). */
export default function PermissionTick({ allowed, label }: { allowed: boolean; label: string }) {
  return allowed ? (
    <ThemeIcon size={22} radius="xl" variant="light" color="green" aria-label={`${label}: yes`}>
      <IconCheck size={14} stroke={3} />
    </ThemeIcon>
  ) : (
    <IconMinus size={16} color="var(--mantine-color-gray-4)" aria-label={`${label}: no`} />
  );
}
