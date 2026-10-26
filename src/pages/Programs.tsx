import { useState } from "react";
import { Badge, Button, Card, Group, Select, Table, Text, TextInput } from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconSchool, IconSearch } from "@tabler/icons-react";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import SearchableSelect from "../components/SearchableSelect";
import DataState from "../components/DataState";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { EntityCell } from "../components/TableCells";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import { confirmDanger } from "../components/confirm";
import { useCan } from "../lib/auth";
import { formatCampusLocation } from "../lib/campuses";
import { toSelectData, useDropdown } from "../lib/dropdowns";
import errorHandler from "../lib/errors";
import {
  IProgram,
  TProgramStatus,
  TStudyMode,
  programStatusColors,
  programStatusLabels,
  studyModeLabels,
  useDeleteProgram,
  usePrograms,
} from "../lib/programs";
import { formatDate, toOptions } from "../lib/utils";

import ProgramForm from "./ProgramForm";
import { NO_AUTOFILL } from "../lib/forms";

const PAGE_SIZE = 20;

export default function Programs() {
  const can = useCan();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<TProgramStatus | null>(null);
  const [studyMode, setStudyMode] = useState<TStudyMode | null>(null);
  const [campusId, setCampusId] = useState<string | null>(null);
  const campuses = useDropdown("campuses");
  // The form stays mounted so it can animate; editing = null means "new program".
  const [formOpened, formHandlers] = useDisclosure();
  const [editing, setEditing] = useState<IProgram | null>(null);
  const openForm = (program: IProgram | null) => {
    setEditing(program);
    formHandlers.open();
  };

  const { data, isLoading, error } = usePrograms({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status ?? undefined,
    studyMode: studyMode ?? undefined,
    campusId: campusId ? Number(campusId) : undefined,
  });
  const deleteProgram = useDeleteProgram();
  const hasFilters = Boolean(debouncedSearch || status || studyMode || campusId);

  // After deleting the last program on the last page, step back a page.

  // Every filter change starts again from page 1.
  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const confirmDelete = (program: IProgram) =>
    confirmDanger({
      title: "Delete program",
      message: (
        <>
          Delete <b>{program.name}</b> ({program.code})? It goes from the app and its code can be used again.
          To hide it but keep it, set its status to Archived instead.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteProgram.mutate(program.id, {
          onSuccess: () =>
            notifications.show({ color: "green", title: "Program deleted", message: program.name }),
          onError: (err) => errorHandler(err, "Could not delete program"),
        }),
    });

  return (
    <Page>
      <PageHeader
        title="Programs"
        description="What students apply to: each with its campus, deadline, eligibility and letters."
        action={
          can("programs", "create") && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              New Program
            </Button>
          )
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="md" gap="sm">
          <TextInput
            placeholder="Search by name or code"
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => withPageReset(setSearch)(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <SearchableSelect
            placeholder="All campuses"
            data={toSelectData(campuses.data)}
            value={campusId}
            onChange={withPageReset(setCampusId)}
            clearable
            w={{ base: "100%", sm: 170 }}
          />
          <Select
            placeholder="All statuses"
            data={toOptions(programStatusLabels)}
            value={status}
            onChange={(value) => withPageReset(setStatus)(value as TProgramStatus | null)}
            clearable
            w={{ base: "100%", sm: 170 }}
          />
          <Select
            placeholder="All study modes"
            data={toOptions(studyModeLabels)}
            value={studyMode}
            onChange={(value) => withPageReset(setStudyMode)(value as TStudyMode | null)}
            clearable
            w={{ base: "100%", sm: 170 }}
          />
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load programs"
          isEmpty={!data?.items.length}
          emptyIcon={IconSchool}
          emptyTitle={hasFilters ? "No programs match your filters" : "No programs yet"}
          emptyText={hasFilters ? undefined : "Create your first program to start taking applications."}
        >
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Program</Table.Th>
                  <Table.Th>Award Level</Table.Th>
                  <Table.Th>Campus</Table.Th>
                  <Table.Th>Study Mode</Table.Th>
                  <Table.Th>Deadline</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.items.map((program, index) => (
                  <Table.Tr
                    key={program.id}
                    {...rowClick(can("programs", "update") ? () => openForm(program) : undefined)}
                  >
                    <SerialCell index={index} offset={(data.page - 1) * data.limit} />
                    <Table.Td>
                      <EntityCell icon={IconSchool} title={program.name} subtitle={program.code} />
                    </Table.Td>
                    <Table.Td>{program.awardLevel ?? "—"}</Table.Td>
                    <Table.Td>
                      {program.campus ? (
                        <>
                          <Text size="sm" truncate maw={240}>
                            {program.campus.name}
                          </Text>
                          <Text size="xs" c="dimmed" truncate maw={240}>
                            {formatCampusLocation(program.campus)}
                          </Text>
                        </>
                      ) : (
                        "—"
                      )}
                    </Table.Td>
                    <Table.Td>{studyModeLabels[program.studyMode]}</Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      {formatDate(program.applicationDeadline)}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={programStatusColors[program.status]}>
                        {programStatusLabels[program.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <RowActions
                        name={program.name}
                        onEdit={can("programs", "update") ? () => openForm(program) : undefined}
                        onDelete={can("programs", "delete") ? () => confirmDelete(program) : undefined}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>

        <ListFooter data={data} page={page} onChange={setPage} />
      </Card>

      <ProgramForm opened={formOpened} program={editing} onClose={formHandlers.close} />
    </Page>
  );
}
