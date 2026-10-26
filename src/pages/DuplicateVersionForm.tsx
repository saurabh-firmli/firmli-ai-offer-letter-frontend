import { useEffect, useState } from "react";
import { Alert, Select, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle } from "@tabler/icons-react";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import SearchableSelect from "../components/SearchableSelect";
import {
  IVersionSummary,
  useCopyFromVersion,
  useEligibilitySet,
  useEligibilitySets,
  versionLabel,
} from "../lib/eligibility";
import errorHandler from "../lib/errors";
import { toIdOptions } from "../lib/utils";

interface IDuplicateVersionFormProps {
  opened: boolean;
  setId: number;
  draft: IVersionSummary; // the draft that receives the copy
  onClose: () => void;
}

/** "Duplicate From": replaces the draft's criteria and documents with another version's (any set). */
export default function DuplicateVersionForm({ opened, setId, draft, onClose }: IDuplicateVersionFormProps) {
  const copy = useCopyFromVersion();
  const [sourceSetId, setSourceSetId] = useState<string | null>(null);
  const [sourceVersionId, setSourceVersionId] = useState<string | null>(null);
  const sets = useEligibilitySets("", opened);
  const sourceSet = useEligibilitySet(sourceSetId ? Number(sourceSetId) : null);

  // Opens on this set; the version is picked by hand.
  useEffect(() => {
    if (!opened) return;
    setSourceSetId(String(setId));
    setSourceVersionId(null);
  }, [opened, setId]);

  const versionOptions = (sourceSet.data?.versions ?? [])
    .filter(({ id }) => id !== draft.id)
    .map((version) => ({
      value: String(version.id),
      label: `${versionLabel(version)} · ${version.criteriaCount} criteria`,
    }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sourceVersionId) return;
    copy.mutate(
      { versionId: draft.id, fromVersionId: Number(sourceVersionId) },
      {
        onSuccess: () => {
          notifications.show({
            color: "green",
            title: "Draft updated",
            message: `Copied into v${draft.versionNumber}`,
          });
          onClose();
        },
        onError: (error) => errorHandler(error, "Could not copy the version"),
      }
    );
  };

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title="Duplicate From"
      description={`Copy criteria and documents into the v${draft.versionNumber} draft.`}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <SearchableSelect
            label="Eligibility Set"
            withAsterisk
            placeholder={sets.isLoading ? "Loading..." : "Select set"}
            data={toIdOptions(sets.data)}
            value={sourceSetId}
            onChange={(value) => {
              setSourceSetId(value);
              setSourceVersionId(null);
            }}
          />
          <Select
            label="Version"
            withAsterisk
            placeholder={
              !sourceSetId ? "Select a set first" : sourceSet.isLoading ? "Loading..." : "Select version"
            }
            disabled={!sourceSetId}
            data={versionOptions}
            nothingFoundMessage="No other version in this set"
            value={sourceVersionId}
            onChange={setSourceVersionId}
          />
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
            This replaces everything in the v{draft.versionNumber} draft.
          </Alert>
          <FormActions onCancel={onClose} submitLabel="Copy into Draft" loading={copy.isPending} />
        </Stack>
      </form>
    </FormModal>
  );
}
