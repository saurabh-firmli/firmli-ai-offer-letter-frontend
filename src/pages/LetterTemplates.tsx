import { useState } from "react";
import { Badge, Button, Card, Group, Select, Table, TextInput } from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconFileCertificate, IconPlus, IconSearch } from "@tabler/icons-react";
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
  ILetterTemplateSummary,
  TLetterType,
  TTemplateStatus,
  letterTypeLabels,
  templateStatusColors,
  templateStatusLabels,
  useDeleteLetterTemplate,
  useLetterTemplates,
} from "../lib/letterTemplates";
import { toOptions } from "../lib/utils";
import LetterTemplateForm from "./LetterTemplateForm";
import { NO_AUTOFILL } from "../lib/forms";

export default function LetterTemplates() {
  const can = useCan();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [letterType, setLetterType] = useState<TLetterType | null>(null);
  const [status, setStatus] = useState<TTemplateStatus | null>(null);
  // The form stays mounted so it can animate; editing = null means "new template".
  const [formOpened, formHandlers] = useDisclosure();
  const [editing, setEditing] = useState<ILetterTemplateSummary | null>(null);
  const openForm = (template: ILetterTemplateSummary | null) => {
    setEditing(template);
    formHandlers.open();
  };

  const {
    data: templates,
    isLoading,
    error,
  } = useLetterTemplates({
    search: debouncedSearch || undefined,
    letterType: letterType ?? undefined,
    status: status ?? undefined,
  });
  const deleteTemplate = useDeleteLetterTemplate();
  const hasFilters = Boolean(debouncedSearch || letterType || status);

  // A template that programs use comes back as a 409 with a message saying so.
  const confirmDelete = (template: ILetterTemplateSummary) =>
    confirmDanger({
      title: "Delete letter template",
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
            notifications.show({ color: "green", title: "Letter template deleted", message: template.name }),
          onError: (err) => errorHandler(err, "Could not delete template"),
        }),
    });

  return (
    <Page>
      <PageHeader
        title="Letter Templates"
        description="The letters sent to students, one template per letter type."
        action={
          can("letter_templates", "create") && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              New Letter Template
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
            placeholder="All letter types"
            data={toOptions(letterTypeLabels)}
            value={letterType}
            onChange={(value) => setLetterType(value as TLetterType | null)}
            clearable
            w={{ base: "100%", sm: 190 }}
          />
          <Select
            placeholder="All statuses"
            data={toOptions(templateStatusLabels)}
            value={status}
            onChange={(value) => setStatus(value as TTemplateStatus | null)}
            clearable
            w={{ base: "100%", sm: 170 }}
          />
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load templates"
          isEmpty={!templates?.length}
          emptyIcon={IconFileCertificate}
          emptyTitle={hasFilters ? "No templates match your filters" : "No letter templates yet"}
          emptyText={hasFilters ? undefined : "Create a template for each letter you send to students."}
        >
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Template</Table.Th>
                  <Table.Th>Letter Type</Table.Th>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {templates?.map((template, index) => (
                  <Table.Tr
                    key={template.id}
                    {...rowClick(can("letter_templates", "update") ? () => openForm(template) : undefined)}
                  >
                    <SerialCell index={index} />
                    <Table.Td>
                      <EntityCell
                        icon={IconFileCertificate}
                        title={template.name}
                        subtitle={template.subject ?? "No subject"}
                      />
                    </Table.Td>
                    <Table.Td>{letterTypeLabels[template.letterType]}</Table.Td>
                    <Table.Td>{template.referencePrefix}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={templateStatusColors[template.status]}>
                        {templateStatusLabels[template.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <DateCell value={template.updatedAt} />
                    </Table.Td>
                    <Table.Td>
                      <RowActions
                        name={template.name}
                        onEdit={can("letter_templates", "update") ? () => openForm(template) : undefined}
                        onDelete={
                          can("letter_templates", "delete") ? () => confirmDelete(template) : undefined
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

      <LetterTemplateForm opened={formOpened} template={editing} onClose={formHandlers.close} />
    </Page>
  );
}
