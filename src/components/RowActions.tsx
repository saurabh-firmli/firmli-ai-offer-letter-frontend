import { CSSProperties } from "react";
import { ActionIcon, Group, Menu, Text, Tooltip } from "@mantine/core";
import { IconDots, IconEdit, IconTrash } from "@tabler/icons-react";
import classes from "./RowActions.module.css";

/** One more icon before edit (e.g. block / unblock a user), or an item of the "..." menu. */
export interface IRowAction {
  label: string; // tooltip, and with the row name for screen readers
  icon: typeof IconEdit;
  onClick: () => void;
  color?: string; // its hover colour; default primary, like edit
  disabledReason?: string; // menu only: shown greyed, with this line under it (e.g. "Approve the letter first")
}

interface IRowActionsProps {
  name: string; // what the row is, for screen readers ("Edit MSc Data Science")
  onEdit?: () => void; // left out (e.g. no update permission) = no edit icon
  onDelete?: () => void; // left out (e.g. no delete permission) = no delete icon
  deleteLabel?: string;
  deleteDisabledReason?: string; // set to disable delete and explain why in the tooltip
  extra?: IRowAction[];
  menu?: IRowAction[]; // behind a "..." button at the end, for rows with several actions
}

// Grey at rest, the action's colour on hover (red for delete): see RowActions.module.css.
const hoverColor = (color: string) =>
  ({
    "--action-color": `var(--mantine-color-${color}-6)`,
    "--action-bg": `var(--mantine-color-${color}-0)`,
  }) as CSSProperties;

/**
 * Edit and delete icons at the end of a table row, and a "..." menu for more; only the actions
 * passed in are shown. The menu renders in a portal, but React still bubbles its clicks through here,
 * so they don't open the row either.
 */
export default function RowActions({
  name,
  onEdit,
  onDelete,
  deleteLabel = "Delete",
  deleteDisabledReason,
  extra = [],
  menu = [],
}: IRowActionsProps) {
  if (!onEdit && !onDelete && !extra.length && !menu.length) return null;
  // A row can open on click (edit); the icons here must not trigger that too.
  return (
    <Group gap={4} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      {extra.map(({ label, icon: Icon, onClick, color = "primary" }) => (
        <Tooltip key={label} label={label}>
          <ActionIcon
            variant="subtle"
            color="gray"
            className={classes.action}
            style={hoverColor(color)}
            aria-label={`${label} ${name}`}
            onClick={onClick}
          >
            <Icon size={18} />
          </ActionIcon>
        </Tooltip>
      ))}
      {onEdit && (
        <Tooltip label="Edit">
          <ActionIcon
            variant="subtle"
            color="gray"
            className={classes.action}
            style={hoverColor("primary")}
            aria-label={`Edit ${name}`}
            onClick={onEdit}
          >
            <IconEdit size={18} />
          </ActionIcon>
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip label={deleteDisabledReason ?? deleteLabel}>
          {/* data-disabled (not disabled) so the tooltip still shows on hover */}
          <ActionIcon
            variant="subtle"
            color="gray"
            className={classes.action}
            style={hoverColor("red")}
            aria-label={`${deleteLabel} ${name}`}
            data-disabled={deleteDisabledReason ? true : undefined}
            onClick={() => !deleteDisabledReason && onDelete()}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      )}
      {menu.length > 0 && (
        <Menu position="bottom-end" shadow="md" radius="md" width={240}>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              className={classes.action}
              style={hoverColor("primary")}
              aria-label={`More actions for ${name}`}
            >
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {menu.map(({ label, icon: Icon, onClick, color, disabledReason }) => (
              <Menu.Item
                key={label}
                leftSection={<Icon size={16} />}
                color={color === "red" ? "red" : undefined}
                onClick={onClick}
                disabled={Boolean(disabledReason)}
              >
                {label}
                {disabledReason && (
                  <Text size="xs" c="dimmed">
                    {disabledReason}
                  </Text>
                )}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

/**
 * Props for a table row that opens on click (usually its edit form), or nothing when it can't
 * (e.g. no permission). The row's RowActions stop their own clicks from reaching it.
 */
export const rowClick = (onClick?: () => void) => (onClick ? { onClick, style: { cursor: "pointer" } } : {});
