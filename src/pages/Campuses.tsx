import { useState } from "react";
import { Button, Card, Group, Table, TextInput } from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconBuilding, IconPlus, IconSearch } from "@tabler/icons-react";
import Page from "../components/Page";
import DataState from "../components/DataState";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { DateCell, EntityCell } from "../components/TableCells";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import { confirmDanger } from "../components/confirm";
import { useCan } from "../lib/auth";
import { ICampus, useCampuses, useDeleteCampus } from "../lib/campuses";
import errorHandler from "../lib/errors";
import CampusForm from "./CampusForm";
import { NO_AUTOFILL } from "../lib/forms";

export default function Campuses() {
  const can = useCan();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [formOpened, formHandlers] = useDisclosure();
  const [editing, setEditing] = useState<ICampus | null>(null);
  const openForm = (campus: ICampus | null) => {
    setEditing(campus);
    formHandlers.open();
  };

  const { data: campuses, isLoading, error } = useCampuses(debouncedSearch);
  const deleteCampus = useDeleteCampus();

  // A campus still used by programs comes back as a 409 with a message saying so.
  const confirmDelete = (campus: ICampus) =>
    confirmDanger({
      title: "Delete campus",
      message: (
        <>
          Delete <b>{campus.name}</b>? A campus that programs still use can't be deleted; move those programs
          to another campus first.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteCampus.mutate(campus.id, {
          onSuccess: () =>
            notifications.show({ color: "green", title: "Campus deleted", message: campus.name }),
          onError: (err) => errorHandler(err, "Could not delete campus"),
        }),
    });

  return (
    <Page>
      <PageHeader
        title="Campuses"
        description="Where your programs are taught. Each program picks one."
        action={
          can("campuses", "create") && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              New Campus
            </Button>
          )
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="md">
          <TextInput
            placeholder="Search by name, city, state or country"
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 420 }}
          />
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load campuses"
          isEmpty={!campuses?.length}
          emptyIcon={IconBuilding}
          emptyTitle={debouncedSearch ? "No campuses match your search" : "No campuses yet"}
          emptyText={debouncedSearch ? undefined : "Add a campus so programs can be assigned to it."}
        >
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Campus</Table.Th>
                  <Table.Th>Country</Table.Th>
                  <Table.Th>Added</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {campuses?.map((campus, index) => (
                  <Table.Tr
                    key={campus.id}
                    {...rowClick(can("campuses", "update") ? () => openForm(campus) : undefined)}
                  >
                    <SerialCell index={index} />
                    <Table.Td>
                      {/* Campuses saved before city / state / country existed have "" until edited. */}
                      <EntityCell
                        icon={IconBuilding}
                        title={campus.name}
                        subtitle={[campus.city, campus.state].filter(Boolean).join(", ") || "No location yet"}
                      />
                    </Table.Td>
                    <Table.Td c={campus.country ? undefined : "dimmed"}>{campus.country || "—"}</Table.Td>
                    <Table.Td>
                      <DateCell value={campus.createdAt} />
                    </Table.Td>
                    <Table.Td>
                      <RowActions
                        name={campus.name}
                        onEdit={can("campuses", "update") ? () => openForm(campus) : undefined}
                        onDelete={can("campuses", "delete") ? () => confirmDelete(campus) : undefined}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>
      </Card>

      <CampusForm opened={formOpened} campus={editing} onClose={formHandlers.close} />
    </Page>
  );
}
