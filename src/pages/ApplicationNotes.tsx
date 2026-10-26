import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconMessage } from "@tabler/icons-react";
import { getInitials, useCan } from "../lib/auth";
import errorHandler, { getFieldErrors } from "../lib/errors";
import { INote, NOTE_MAX, useAddNote, useApplicationNotes } from "../lib/notes";
import { formatDateTime, formatRelative } from "../lib/utils";

/** One note: who, when, and the text as written. Notes can't be edited or deleted. */
export function NoteItem({ note }: { note: INote }) {
  const name = note.createdBy?.name ?? "System";
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Avatar size={30} radius="md" variant="light" color="primary">
        {getInitials(name)}
      </Avatar>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={600} truncate>
            {name}
          </Text>
          <Tooltip label={formatDateTime(note.createdAt)}>
            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {formatRelative(note.createdAt)}
            </Text>
          </Tooltip>
          {note.reviewId && (
            <Badge size="xs" variant="light" color="violet">
              Review
            </Badge>
          )}
        </Group>
        <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {note.note}
        </Text>
      </div>
    </Group>
  );
}

/** The application's notes, newest first, with a box to add one (Applications create). */
export default function ApplicationNotes({ applicationId }: { applicationId: number }) {
  const can = useCan();
  const notes = useApplicationNotes(applicationId);
  const add = useAddNote();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!text.trim()) {
      setError("Write a note first");
      return;
    }
    add.mutate(
      { on: "application", id: applicationId, note: text.trim() },
      {
        onSuccess: () => {
          setText("");
          notifications.show({ color: "green", title: "Note added", message: "It shows on the application" });
        },
        onError: (err) => {
          const fieldError = getFieldErrors(err).note;
          if (fieldError) setError(fieldError);
          else errorHandler(err, "Could not add the note");
        },
      }
    );
  };

  return (
    <Card withBorder radius="lg" shadow="xs" padding="lg">
      <Title order={3} fz={16} mb="md">
        Notes{notes.data?.length ? ` (${notes.data.length})` : ""}
      </Title>

      {can("applications", "create") && (
        <Stack gap="xs" mb="md">
          <Textarea
            placeholder="Add a note for the team, e.g. Called the student about the IELTS score"
            autosize
            minRows={2}
            maxRows={8}
            maxLength={NOTE_MAX}
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
              setError(null);
            }}
            error={error}
          />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Notes can&apos;t be edited or deleted.
            </Text>
            <Button size="xs" onClick={submit} loading={add.isPending}>
              Add Note
            </Button>
          </Group>
        </Stack>
      )}

      {notes.isLoading ? (
        <Stack gap="sm">
          <Skeleton h={14} w="60%" />
          <Skeleton h={30} />
        </Stack>
      ) : notes.data?.length ? (
        <Stack gap="md">
          {notes.data.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </Stack>
      ) : (
        <Group gap="xs" c="dimmed">
          <IconMessage size={16} />
          <Text size="sm" c="dimmed">
            No notes yet.
          </Text>
        </Group>
      )}
    </Card>
  );
}
