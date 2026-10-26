import { useState } from "react";
import { Badge, Button, Card, Group, Select, Table, Text, TextInput } from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconMail, IconPaperclip, IconPlus, IconSearch } from "@tabler/icons-react";
import Page from "../components/Page";
import DataState from "../components/DataState";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { DateCell, EntityCell } from "../components/TableCells";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import { confirmDanger } from "../components/confirm";
import { useCan } from "../lib/auth";
import errorHandler from "../lib/errors";
import {
  IEmailTemplateSummary,
  TEmailType,
  TEmailStatus,
  emailTypeLabels,
  emailStatusColors,
  emailStatusLabels,
  useDeleteEmailTemplate,
  useEmailTemplates,
} from "../lib/emailTemplates";
import { toOptions } from "../lib/utils";
import EmailTemplateForm from "./EmailTemplateForm";
import { NO_AUTOFILL } from "../lib/forms";

export default function EmailTemplates() {
  const can = useCan();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [emailType, setEmailType] = useState<TEmailType | null>(null);
  const [status, setStatus] = useState<TEmailStatus | null>(null);
  // The form stays mounted so it can animate; editing = null means "new template".
  const [formOpened, formHandlers] = useDisclosure();
  const [editing, setEditing] = useState<IEmailTemplateSummary | null>(null);
  const openForm = (template: IEmailTemplateSummary | null) => {
    setEditing(template);
    formHandlers.open();
  };

  const {
    data: templates,
    isLoading,
    error,
  } = useEmailTemplates({
    search: debouncedSearch || undefined,
    emailType: emailType ?? undefined,
    status: status ?? undefined,
  });
  const deleteTemplate = useDeleteEmailTemplate();
  const hasFilters = Boolean(debouncedSearch || emailType || status);

  // A template that programs use comes back as a 409 with a message saying so.
  const confirmDelete = (template: IEmailTemplateSummary) =>
    confirmDanger({
      title: "Delete email template",
      message: (
        <>
          Delete <b>{template.name}</b>? A template that programs use can't be deleted; pick another template
          on those programs first.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteTemplate.mutate(template.id, {
          onSuccess: () =>
            notifications.show({ color: "green", title: "Email template deleted", message: template.name }),
          onError: (err) => errorHandler(err, "Could not delete template"),
        }),
    });

  return (
    <Page>
      <PageHeader
        title="Email Templates"
        description="The emails sent to students; programs pick one for offers and one for rejections."
        action={
          can("email_templates", "create") && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              New Email Template
            </Button>
          )
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="md" gap="sm">
          <TextInput
            placeholder="Search by name or subject"
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select
            placeholder="All email types"
            data={toOptions(emailTypeLabels)}
            value={emailType}
            onChange={(value) => setEmailType(value as TEmailType | null)}
            clearable
            w={{ base: "100%", sm: 190 }}
          />
          <Select
            placeholder="All statuses"
            data={toOptions(emailStatusLabels)}
            value={status}
            onChange={(value) => setStatus(value as TEmailStatus | null)}
            clearable
            w={{ base: "100%", sm: 170 }}
          />
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load templates"
          isEmpty={!templates?.length}
          emptyIcon={IconMail}
          emptyTitle={hasFilters ? "No templates match your filters" : "No email templates yet"}
          emptyText={hasFilters ? undefined : "Create a template for each email you send to students."}
        >
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Template</Table.Th>
                  <Table.Th>Email Type</Table.Th>
                  <Table.Th>PDF Letter</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {templates?.map((template, index) => (
                  <Table.Tr
                    key={template.id}
                    {...rowClick(can("email_templates", "update") ? () => openForm(template) : undefined)}
                  >
                    <SerialCell index={index} />
                    <Table.Td>
                      <EntityCell
                        icon={IconMail}
                        title={template.name}
                        subtitle={template.subject ?? "No subject"}
                      />
                    </Table.Td>
                    <Table.Td>{emailTypeLabels[template.emailType]}</Table.Td>
                    <Table.Td>
                      {template.attachPdfLetter ? (
                        <Group gap={4} wrap="nowrap">
                          <IconPaperclip size={14} />
                          <Text size="sm">Attached</Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={emailStatusColors[template.status]}>
                        {emailStatusLabels[template.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <DateCell value={template.updatedAt} />
                    </Table.Td>
                    <Table.Td>
                      <RowActions
                        name={template.name}
                        onEdit={can("email_templates", "update") ? () => openForm(template) : undefined}
                        onDelete={
                          can("email_templates", "delete") ? () => confirmDelete(template) : undefined
                        }
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>
      </Card>

      <EmailTemplateForm opened={formOpened} template={editing} onClose={formHandlers.close} />
    </Page>
  );
}
