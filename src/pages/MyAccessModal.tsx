import { Badge, Group, Table, Text } from "@mantine/core";
import { IconInfoCircle, IconShieldLock } from "@tabler/icons-react";
import FormModal from "../components/FormModal";
import PermissionTick from "../components/PermissionTick";
import { IUser, TModule } from "../lib/auth";
import { ALL_ACTIONS, PERMISSION_ACTIONS, accessSummary } from "../lib/roles";
import { navItems } from "../layout/navItems";

/**
 * One row per module the role can use, in sidebar order (a module without a page yet comes last),
 * with the actions it has from GET /auth/me `modules`.
 */
export function myModules(me: IUser) {
  const known = new Map((me.modules ?? []).map((module) => [module.code, module]));
  const order = (module: string) => {
    const index = navItems.findIndex((nav) => nav.module === module);
    return index < 0 ? navItems.length : index;
  };
  return Object.entries(me.permissions ?? {})
    .filter(([, permission]) => permission && Object.values(permission).some(Boolean))
    .map(([code, permission]) => {
      const module = code as TModule;
      const item = navItems.find((nav) => nav.module === module);
      const info = known.get(module);
      const allowed = PERMISSION_ACTIONS.filter(({ action }) => permission![action]).map(
        ({ action }) => action
      );
      return {
        module,
        label:
          item?.label ?? info?.name ?? code.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase()),
        icon: item?.icon ?? IconShieldLock,
        permission: permission!,
        allowed,
        actions: info?.actions ?? ALL_ACTIONS,
      };
    })
    .sort((a, b) => order(a.module) - order(b.module));
}

/**
 * What my role may do, module by module, as ticks like the Roles & Permissions page (read only).
 * The module names and switches come from GET /roles when the role may read it.
 */
export default function MyAccessModal({
  me,
  opened,
  onClose,
}: {
  me: IUser;
  opened: boolean;
  onClose: () => void;
}) {
  const modules = myModules(me);

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={720}
      title="Your Access"
      description={`What the ${me.roleName} role can do in ${me.tenant?.name ?? "your institution"}.`}
    >
      <Table.ScrollContainer minWidth={560}>
        <Table verticalSpacing="sm" horizontalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Module</Table.Th>
              <Table.Th w={120}>Access</Table.Th>
              {PERMISSION_ACTIONS.map(({ action, label }) => (
                <Table.Th key={action} w={70} ta="center">
                  {label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {modules.map(({ module, label, icon: Icon, permission, allowed, actions }) => {
              const summary = accessSummary(allowed, actions);
              return (
                <Table.Tr key={module}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Icon size={18} color="var(--mantine-color-dimmed)" />
                      <div>
                        <Text fw={600} size="sm">
                          {label}
                        </Text>
                        {/* The API decides whose logs a role sees. */}
                        {module === "audit_logs" && (
                          <Text size="xs" c="dimmed">
                            {me.role === "super_admin" ? "Everyone's changes" : "Only your own changes"}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={summary.color}>
                      {summary.label}
                    </Badge>
                  </Table.Td>
                  {PERMISSION_ACTIONS.map(({ action, label: actionLabel }) => (
                    <Table.Td key={action} ta="center">
                      {/* An action the module doesn't have (e.g. Add on Audit Logs) stays empty. */}
                      {actions.includes(action) && (
                        <PermissionTick allowed={permission[action]} label={actionLabel} />
                      )}
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Group gap={6} mt="md" wrap="nowrap">
        <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        <Text size="xs" c="dimmed">
          A Super Admin sets each role&apos;s access on Roles &amp; Permissions. Need more? Ask them.
        </Text>
      </Group>
    </FormModal>
  );
}
