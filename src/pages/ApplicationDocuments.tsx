import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  FileButton,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconDownload,
  IconSparkles,
  IconFile,
  IconFileText,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { confirmDanger } from "../components/confirm";
import {
  IApplication,
  IApplicationDocument,
  downloadDocument,
  formatFileSize,
  requirementLabel,
  useApplicationOptions,
  useDeleteDocument,
  useUploadDocument,
} from "../lib/applications";
import { useCan } from "../lib/auth";
import { useEligibilityOptions } from "../lib/eligibility";
import errorHandler from "../lib/errors";
import { formatDateTime } from "../lib/utils";
import DocumentReadingModal from "./DocumentReadingModal";

interface IApplicationDocumentsProps {
  application: IApplication; // from GET /applications/:id (with documentRequirements)
  editable: boolean; // a draft: files can be added and removed
  // In manual review, files can still be added (what the reviewer asked the student for), not removed.
  addOnly?: boolean;
}

/** One uploaded file: name, size, who and when; download, and remove on a draft. */
function DocumentFile({
  document,
  onRemove,
  onRead,
}: {
  document: IApplicationDocument;
  onRemove?: () => void;
  onRead: () => void; // what the AI read from it, and Extract
}) {
  const [opening, setOpening] = useState(false);
  const download = async () => {
    setOpening(true);
    try {
      await downloadDocument(document.id);
    } catch (error) {
      errorHandler(error, "Could not download the file");
    } finally {
      setOpening(false);
    }
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" py={6}>
      <Group gap="sm" wrap="nowrap" miw={0}>
        <IconFile size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>
            {document.originalName}
          </Text>
          <Text size="xs" c="dimmed">
            {formatFileSize(document.sizeBytes)} · {document.uploadedBy?.name ?? "System"} ·{" "}
            {formatDateTime(document.createdAt)}
          </Text>
        </div>
      </Group>
      <Group gap={2} wrap="nowrap">
        <Tooltip label="AI reading">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onRead}
            aria-label={`AI reading of ${document.originalName}`}
          >
            <IconSparkles size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Download">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={download}
            loading={opening}
            aria-label={`Download ${document.originalName}`}
          >
            <IconDownload size={18} />
          </ActionIcon>
        </Tooltip>
        {onRemove && (
          <Tooltip label="Remove">
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={onRemove}
              aria-label={`Remove ${document.originalName}`}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Group>
  );
}

/**
 * The documents the program asks for, each with its files; on a draft, an Upload button per document
 * and one for any other document. Files: PDF, DOCX, JPG, PNG, at most 10 MB (checked again by the API).
 */
export default function ApplicationDocuments({
  application,
  editable,
  addOnly = false,
}: IApplicationDocumentsProps) {
  const can = useCan();
  const options = useApplicationOptions();
  const eligibility = useEligibilityOptions(editable || addOnly);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const [uploadingType, setUploadingType] = useState<number | null>(null);
  const [otherTypeId, setOtherTypeId] = useState<string | null>(null);
  const [reading, setReading] = useState<IApplicationDocument | null>(null); // the file whose AI reading is open

  const canUpload = (editable || addOnly) && can("applications", "create");
  const canRemove = editable && can("applications", "delete");
  const limits = options.data?.upload ?? {
    maxSizeMb: 10,
    extensions: [".pdf", ".docx", ".jpg", ".jpeg", ".png"],
  };
  const accept = limits.extensions.join(",");

  const handleFile = (documentTypeId: number, file: File | null) => {
    if (!file) return;
    // Quick checks before sending; the API also checks the content matches the extension.
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!limits.extensions.includes(extension)) {
      notifications.show({
        color: "red",
        title: "File not accepted",
        message: `Use ${limits.extensions.join(", ")}`,
      });
      return;
    }
    if (file.size > limits.maxSizeMb * 1024 * 1024) {
      notifications.show({
        color: "red",
        title: "File too large",
        message: `At most ${limits.maxSizeMb} MB`,
      });
      return;
    }
    setUploadingType(documentTypeId);
    upload.mutate(
      { applicationId: application.id, documentTypeId, file },
      {
        onSuccess: (saved) => {
          notifications.show({ color: "green", title: "File uploaded", message: saved.originalName });
          setOtherTypeId(null);
        },
        onError: (error) => errorHandler(error, "Could not upload the file"),
        onSettled: () => setUploadingType(null),
      }
    );
  };

  const confirmRemove = (document: IApplicationDocument) =>
    confirmDanger({
      title: "Remove file",
      message: (
        <>
          Remove <b>{document.originalName}</b> from this application?
        </>
      ),
      confirmLabel: "Remove",
      onConfirm: () =>
        remove.mutate(document.id, {
          onSuccess: () =>
            notifications.show({ color: "green", title: "File removed", message: document.originalName }),
          onError: (error) => errorHandler(error, "Could not remove the file"),
        }),
    });

  const uploadButton = (documentTypeId: number, label = "Upload") => (
    <FileButton
      accept={accept}
      onChange={(file) => handleFile(documentTypeId, file)}
      // Emptied on each click, so the same file can be picked again (after an error, or a second copy).
      inputProps={{ onClick: (event) => (event.currentTarget.value = "") }}
    >
      {(props) => (
        <Button
          {...props}
          size="xs"
          variant="secondary"
          leftSection={<IconUpload size={14} />}
          loading={uploadingType === documentTypeId}
          disabled={uploadingType !== null && uploadingType !== documentTypeId}
        >
          {label}
        </Button>
      )}
    </FileButton>
  );

  const requirements = application.documentRequirements ?? [];
  const others = application.otherDocuments ?? [];

  return (
    <Stack gap="sm">
      {requirements.length === 0 && (
        <Text size="sm" c="dimmed">
          The program's criteria ask for no documents.
        </Text>
      )}

      {requirements.map((requirement) => {
        const done = requirement.documents.length > 0;
        const icon = done ? (
          <ThemeIcon size={34} radius="md" variant="light" color="green">
            <IconCircleCheck size={18} />
          </ThemeIcon>
        ) : requirement.isRequired ? (
          <ThemeIcon size={34} radius="md" variant="light" color="orange">
            <IconAlertCircle size={18} />
          </ThemeIcon>
        ) : (
          <ThemeIcon size={34} radius="md" variant="light" color="gray">
            <IconFileText size={18} />
          </ThemeIcon>
        );
        return (
          <Paper key={requirement.documentTypeId} withBorder radius="md" p="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
              <Group gap="sm" wrap="nowrap" align="flex-start" miw={0}>
                {icon}
                <div style={{ minWidth: 0 }}>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>
                      {requirementLabel(requirement)}
                    </Text>
                    <Badge size="xs" variant="light" color={requirement.isRequired ? "primary" : "gray"}>
                      {requirement.isRequired ? "Required" : "Optional"}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {requirement.instructions ||
                      (requirement.customLabel
                        ? requirement.documentType
                        : done
                          ? "Uploaded"
                          : "Not uploaded yet")}
                  </Text>
                </div>
              </Group>
              {canUpload && uploadButton(requirement.documentTypeId, done ? "Add file" : "Upload")}
            </Group>
            {done && (
              <Stack gap={0} mt="xs" pl={46}>
                {requirement.documents.map((document) => (
                  <DocumentFile
                    key={document.id}
                    document={document}
                    onRemove={canRemove ? () => confirmRemove(document) : undefined}
                    onRead={() => setReading(document)}
                  />
                ))}
              </Stack>
            )}
          </Paper>
        );
      })}

      {(others.length > 0 || canUpload) && (
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" wrap="nowrap" gap="md">
            <div>
              <Text size="sm" fw={600}>
                Other Documents
              </Text>
              <Text size="xs" c="dimmed">
                Anything the program doesn't ask for, e.g. a recommendation letter
              </Text>
            </div>
            {canUpload && (
              <Group gap="xs" wrap="nowrap">
                <Select
                  placeholder="Select document type"
                  data={(eligibility.data?.documentTypes ?? []).map(({ id, label }) => ({
                    value: String(id),
                    label,
                  }))}
                  value={otherTypeId}
                  onChange={setOtherTypeId}
                  size="xs"
                  w={200}
                  searchable={false}
                  aria-label="Document type"
                />
                {otherTypeId ? (
                  uploadButton(Number(otherTypeId))
                ) : (
                  <Button size="xs" variant="secondary" leftSection={<IconUpload size={14} />} disabled>
                    Upload
                  </Button>
                )}
              </Group>
            )}
          </Group>
          {others.length > 0 && (
            <Stack gap={0} mt="xs">
              {others.map((document) => (
                <DocumentFile
                  key={document.id}
                  document={document}
                  onRemove={canRemove ? () => confirmRemove(document) : undefined}
                  onRead={() => setReading(document)}
                />
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Text size="xs" c="dimmed">
        PDF, DOCX, JPG or PNG, up to {limits.maxSizeMb} MB each.
      </Text>

      <DocumentReadingModal document={reading} onClose={() => setReading(null)} />
    </Stack>
  );
}
