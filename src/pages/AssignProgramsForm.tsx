import { useEffect, useState } from "react";
import { Checkbox, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSearch } from "@tabler/icons-react";
import DataState from "../components/DataState";
import { ListSkeleton } from "../components/Skeletons";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import { IEligibilitySet, useAssignPrograms } from "../lib/eligibility";
import errorHandler from "../lib/errors";
import { useDropdown } from "../lib/dropdowns";
import { NO_AUTOFILL } from "../lib/forms";

interface IAssignProgramsFormProps {
  opened: boolean;
  set: IEligibilitySet;
  onClose: () => void;
}

/** Picks exactly which programs use this set (programs moved here leave their old set). */
export default function AssignProgramsForm({ opened, set, onClose }: IAssignProgramsFormProps) {
  const assign = useAssignPrograms();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  // The API's page limit; enough for one company's programs for now.
  const programs = useDropdown("programs", { withEligibilitySet: "true" }, opened);

  // Start from the programs that use the set today, every time the modal opens.
  useEffect(() => {
    if (!opened) return;
    setSelected(set.programs.map(({ id }) => String(id)));
    setSearch("");
  }, [opened, set]);

  const query = search.trim().toLowerCase();
  // The label has the code too: "MSc Data Science (MSDS)".
  const shown = (programs.data ?? []).filter(({ label }) => !query || label.toLowerCase().includes(query));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    assign.mutate(
      { setId: set.id, programIds: selected.map(Number) },
      {
        onSuccess: () => {
          notifications.show({ color: "green", title: "Programs updated", message: set.name });
          onClose();
        },
        onError: (error) => errorHandler(error, "Could not assign programs"),
      }
    );
  };

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title="Assign to Programs"
      description={`Programs that use ${set.name}. A program can use one set; ticking it here moves it from its current set.`}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            placeholder="Search by name or code"
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            data-autofocus
          />
          <DataState
            isLoading={programs.isLoading}
            skeleton={<ListSkeleton rows={5} />}
            error={programs.error}
            errorTitle="Could not load programs"
            isEmpty={!shown.length}
            emptyTitle={query ? "No programs match your search" : "No programs yet"}
          >
            <ScrollArea.Autosize mah={320}>
              <Checkbox.Group value={selected} onChange={setSelected}>
                <Stack gap="sm">
                  {shown.map(({ value, label, eligibilitySet }) => (
                    <Checkbox
                      key={value}
                      value={String(value)}
                      label={label}
                      description={
                        eligibilitySet && eligibilitySet.id !== set.id
                          ? `Uses ${eligibilitySet.name} now`
                          : undefined
                      }
                    />
                  ))}
                </Stack>
              </Checkbox.Group>
            </ScrollArea.Autosize>
          </DataState>
          <Text size="sm" c="dimmed">
            {selected.length} selected
          </Text>
          <FormActions onCancel={onClose} submitLabel="Save Changes" loading={assign.isPending} />
        </Stack>
      </form>
    </FormModal>
  );
}
