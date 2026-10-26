import { Alert, Button, Group, Progress, Skeleton, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle, IconSparkles } from "@tabler/icons-react";
import FormModal from "../components/FormModal";
import { IApplicationDocument, useDocumentReading, useExtractDocument } from "../lib/applications";
import { useCan } from "../lib/auth";
import errorHandler from "../lib/errors";
import { formatDateTime } from "../lib/utils";
import { DocumentReadingView } from "./ApplicationAssessment";

/**
 * What the AI read from one file (from the last assessment run or an earlier Extract), and Extract
 * to read it again now. Extract never changes the application or its assessment.
 */
export default function DocumentReadingModal({
  document,
  onClose,
}: {
  document: IApplicationDocument | null; // null = closed
  onClose: () => void;
}) {
  const can = useCan();
  const reading = useDocumentReading(document?.id ?? null);
  const extract = useExtractDocument();

  const run = () =>
    document &&
    extract.mutate(document.id, {
      onSuccess: (result) =>
        notifications.show({
          color: result.status === "completed" ? "green" : "orange",
          title: result.status === "completed" ? "Document read" : "Could not read the document",
          message: result.errorMessage ?? document.originalName,
        }),
      // e.g. no OpenAI key: "Add your institution's OpenAI API key in Settings first"
      onError: (error) => errorHandler(error, "Could not extract the document"),
    });

  const data = reading.data;

  return (
    <FormModal
      opened={Boolean(document)}
      onClose={onClose}
      title="AI Reading"
      description={document ? `${document.originalName} · ${document.documentType}` : undefined}
      size={640}
    >
      <Stack>
        {extract.isPending ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              The AI is reading the document
            </Text>
            <Text size="xs" c="dimmed">
              This can take up to a minute.
            </Text>
            <Progress value={100} animated striped color="violet" size="sm" />
          </Stack>
        ) : reading.isLoading ? (
          <Stack gap="sm">
            <Skeleton h={18} w="50%" />
            <Skeleton h={12} w="70%" />
            <Skeleton h={80} />
          </Stack>
        ) : data ? (
          <>
            <Text size="xs" c="dimmed">
              Read {formatDateTime(data.createdAt)}
              {data.assessmentId
                ? " during an assessment"
                : data.requestedBy
                  ? ` by ${data.requestedBy.name}`
                  : ""}
            </Text>
            <DocumentReadingView document={data} />
          </>
        ) : (
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
            The AI hasn&apos;t read this document yet. Extract reads it now, without changing the application.
          </Alert>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {can("applications", "create") && (
            <Button leftSection={<IconSparkles size={16} />} onClick={run} loading={extract.isPending}>
              {data ? "Read Again" : "Extract Now"}
            </Button>
          )}
        </Group>
      </Stack>
    </FormModal>
  );
}
