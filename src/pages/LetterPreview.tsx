import { Text } from "@mantine/core";
import { PreviewModal, TemplateHtml } from "../components/TemplatePreview";
import { ITemplateVariable } from "../lib/letterTemplates";
import classes from "./LetterPreview.module.css";

export interface ILetterPreviewContent {
  subject: string;
  body: string;
  headerHtml: string;
  footerHtml: string;
  referencePrefix: string;
  signatoryName: string;
  signatoryTitle: string;
}

interface ILetterPreviewProps {
  opened: boolean;
  onClose: () => void;
  content: ILetterPreviewContent;
  variables: ITemplateVariable[];
}

/** What a letter from this template looks like, from the form's current (unsaved) values. */
export default function LetterPreview({ opened, onClose, content, variables }: ILetterPreviewProps) {
  // The API stores the prefix in capitals; "LTR" is its default.
  const reference = `${content.referencePrefix.trim().toUpperCase() || "LTR"}-0001`;

  return (
    <PreviewModal
      opened={opened}
      onClose={onClose}
      title="Letter Preview"
      description="Variables show as their names; each student's details are filled in when the letter is sent."
    >
      {content.headerHtml.trim() && <TemplateHtml html={content.headerHtml} variables={variables} />}

      <div className={classes.meta}>
        <span>Ref: {reference}</span>
      </div>

      {content.subject.trim() && (
        <TemplateHtml html={content.subject} variables={variables} className={classes.subject} />
      )}

      {content.body.trim() ? (
        <TemplateHtml html={content.body} variables={variables} />
      ) : (
        <Text c="dimmed" fs="italic">
          The body is empty.
        </Text>
      )}

      {(content.signatoryName.trim() || content.signatoryTitle.trim()) && (
        <div className={classes.signature}>
          <div>
            <strong>{content.signatoryName}</strong>
          </div>
          <div>{content.signatoryTitle}</div>
        </div>
      )}

      {content.footerHtml.trim() && (
        <TemplateHtml html={content.footerHtml} variables={variables} className={classes.footer} />
      )}
    </PreviewModal>
  );
}
