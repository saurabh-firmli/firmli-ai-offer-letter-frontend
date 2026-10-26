import { Text, ThemeIcon } from "@mantine/core";
import { IconUser } from "@tabler/icons-react";
import { AttachmentChip, PreviewModal, TemplateHtml } from "../components/TemplatePreview";
import { ITemplateVariable } from "../lib/letterTemplates";
import classes from "./EmailPreview.module.css";

export interface IEmailPreviewContent {
  subject: string;
  cc: string;
  bcc: string;
  body: string;
  attachPdfLetter: boolean;
}

interface IEmailPreviewProps {
  opened: boolean;
  onClose: () => void;
  content: IEmailPreviewContent;
  variables: ITemplateVariable[];
}

/** What an email from this template looks like, from the form's current (unsaved) values. */
export default function EmailPreview({ opened, onClose, content, variables }: IEmailPreviewProps) {
  const copies = [content.cc.trim() && `Cc: ${content.cc}`, content.bcc.trim() && `Bcc: ${content.bcc}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <PreviewModal
      opened={opened}
      onClose={onClose}
      title="Email Preview"
      description="Variables show as their names; each student's details are filled in when the email is sent."
      variant="email"
      footer={
        content.attachPdfLetter && (
          <AttachmentChip name="Letter PDF" hint="The student's letter is attached when it is sent" />
        )
      }
    >
      {/* As a mail app shows it: the subject on top, then who it goes to. */}
      <div className={classes.headers}>
        {content.subject.trim() ? (
          <TemplateHtml html={content.subject} variables={variables} className={classes.subject} />
        ) : (
          <Text className={classes.subject} c="dimmed" fs="italic">
            No subject
          </Text>
        )}
        <div className={classes.recipientRow}>
          <ThemeIcon size={36} radius="xl" variant="light" color="gray">
            <IconUser size={18} />
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text size="sm">
              to <span className={classes.recipient}>Student Email</span>
            </Text>
            {copies && (
              <Text size="xs" c="dimmed" style={{ wordBreak: "break-word" }}>
                {copies}
              </Text>
            )}
          </div>
        </div>
      </div>

      {content.body.trim() ? (
        <TemplateHtml html={content.body} variables={variables} />
      ) : (
        <Text c="dimmed" fs="italic">
          The body is empty.
        </Text>
      )}
    </PreviewModal>
  );
}
