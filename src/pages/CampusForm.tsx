import { Box, SimpleGrid, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconMap, IconMapPin, IconWorld } from "@tabler/icons-react";
import SearchableSelect from "../components/SearchableSelect";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import SectionTitle from "../components/SectionTitle";
import { ICampus, formatCampusLocation, useSaveCampus } from "../lib/campuses";
import { applyFormError, useResetOnOpen } from "../lib/forms";
import { useCities, useCountries, useStates } from "../lib/locations";
import { toIdOptions } from "../lib/utils";

interface ICampusFormProps {
  opened: boolean;
  campus: ICampus | null; // null = create a new one
  onClose: () => void;
  onSaved?: (campus: ICampus) => void;
}

// Select values are strings; only cityId is sent, state and country just narrow the lists.
type TCampusFormValues = {
  name: string;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
};

const toFormValues = (campus: ICampus | null): TCampusFormValues => ({
  name: campus?.name ?? "",
  countryId: campus?.countryId ? String(campus.countryId) : null,
  stateId: campus?.stateId ? String(campus.stateId) : null,
  cityId: campus?.cityId ? String(campus.cityId) : null,
});

const required = (message: string) => (value: string | null) => (value?.trim() ? null : message);

export default function CampusForm({ opened, campus, onClose, onSaved }: ICampusFormProps) {
  const save = useSaveCampus();
  const form = useForm<TCampusFormValues>({
    initialValues: toFormValues(null),
    validate: {
      name: required("Campus name is required"),
      countryId: required("Select a country"),
      stateId: required("Select a state"),
      cityId: required("Select a city"),
    },
  });

  useResetOnOpen(form, opened, campus, toFormValues(campus));

  const { countryId, stateId } = form.getValues();
  // The form stays mounted while closed (e.g. inside the program form), so load only once it opens.
  const countries = useCountries(opened);
  const states = useStates(countryId ? Number(countryId) : null);
  const cities = useCities(stateId ? Number(stateId) : null);

  const handleSubmit = form.onSubmit(({ name, cityId }) =>
    save.mutate(
      { id: campus?.id, name, cityId: Number(cityId) },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: campus ? "Campus updated" : "Campus created",
            message: saved.name,
          });
          onSaved?.(saved);
          onClose();
        },
        // 409 = this name already exists in the same city.
        onError: (error) =>
          applyFormError(form, error, { conflictField: "name", toastTitle: "Could not save campus" }),
      }
    )
  );

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={campus ? "Edit Campus" : "New Campus"}
      description={
        campus ? formatCampusLocation(campus) || campus.name : "Programs can then be linked to this campus."
      }
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Campus Name"
            placeholder="e.g. Main Campus"
            withAsterisk
            maxLength={150}
            data-autofocus
            {...form.getInputProps("name")}
          />

          <Box mt="xs">
            <SectionTitle>Location</SectionTitle>
          </Box>
          {/* Country -> state -> city: picking one clears the ones after it. */}
          <SearchableSelect
            label="Country"
            placeholder={countries.isLoading ? "Loading..." : "Select country"}
            withAsterisk
            leftSection={<IconWorld size={16} />}
            nothingFoundMessage="No country found"
            data={toIdOptions(countries.data)}
            {...form.getInputProps("countryId")}
            onChange={(value) => form.setValues({ countryId: value, stateId: null, cityId: null })}
          />
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <SearchableSelect
              label="State"
              // A disabled field says what it is waiting for.
              placeholder={
                !countryId ? "Select a country first" : states.isLoading ? "Loading..." : "Select state"
              }
              withAsterisk
              disabled={!countryId}
              leftSection={<IconMap size={16} />}
              nothingFoundMessage="No state found"
              data={toIdOptions(states.data)}
              {...form.getInputProps("stateId")}
              onChange={(value) => form.setValues({ stateId: value, cityId: null })}
            />
            <SearchableSelect
              label="City"
              placeholder={
                !stateId ? "Select a state first" : cities.isLoading ? "Loading..." : "Select city"
              }
              withAsterisk
              disabled={!stateId}
              leftSection={<IconMapPin size={16} />}
              nothingFoundMessage="No city found"
              // Some states have thousands of cities: render only the first matches, search for the rest.
              limit={200}
              data={toIdOptions(cities.data)}
              {...form.getInputProps("cityId")}
            />
          </SimpleGrid>

          <FormActions
            onCancel={onClose}
            submitLabel={campus ? "Save Changes" : "Create Campus"}
            loading={save.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}
