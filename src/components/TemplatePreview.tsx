import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import { Group, Modal, Skeleton, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import { IconChevronRight, IconExternalLink, IconFileText, IconFileTypePdf } from "@tabler/icons-react";
import DOMPurify from "dompurify";
import FormHeader from "./FormHeader";
import { BLOCK_VARIABLES, ITemplateVariable } from "../lib/letterTemplates";
import classes from "./TemplatePreview.module.css";

/*
 * Shared by the letter and email previews: a page in a modal, and template HTML shown safely with
 * every {{variable}} marked where it goes.
 */

interface IPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  toolbar?: ReactNode; // above the page, e.g. a letter's status and its actions
  children: ReactNode; // the page content
  // "email": a narrower mail card; an email's tables are its layout, so they get no rules.
  // "frame": the content brings its own page (a PDF in the browser's viewer, a sent email's document),
  // so it is shown edge to edge, with no card of ours around it.
  variant?: "page" | "email" | "frame";
  footer?: ReactNode; // under the page content, e.g. an email's attachments
}

/** A white page on a grey backdrop, in a wide modal. */
export function PreviewModal({
  opened,
  onClose,
  title,
  description,
  toolbar,
  children,
  variant = "page",
  footer,
}: IPreviewModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={900}
      radius="lg"
      padding="xl"
      title={<FormHeader title={title} description={description} />}
    >
      {toolbar}
      {variant === "frame" ? (
        <div className={classes.frame}>
          {children}
          {footer && <div className={classes.footer}>{footer}</div>}
        </div>
      ) : (
        <div className={classes.backdrop}>
          <div className={classes[variant]}>
            <div className={classes.content}>{children}</div>
            {footer && <div className={classes.footer}>{footer}</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Text without any tags is plain text: keep its line breaks.
const toHtml = (text: string) =>
  /<[a-z][\s\S]*>/i.test(text) ? text : escapeHtml(text).replace(/\n/g, "<br />");

interface ITemplateHtmlProps {
  html: string;
  variables: ITemplateVariable[];
  className?: string;
}

/**
 * Template HTML written by users, sanitized with DOMPurify before it is shown, with every {{key}} as
 * its label: a chip for text, a full-width box for a block (table / list), red for an unknown one.
 */
export function TemplateHtml({ html, variables, className }: ITemplateHtmlProps) {
  const labels = new Map(variables.map(({ key, label }) => [key, label]));
  const filled = toHtml(html).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const label = labels.get(key);
    if (!label) return `<span class="${classes.unknown}">Unknown: ${escapeHtml(key)}</span>`;
    const variableClass = BLOCK_VARIABLES.has(key) ? classes.block : classes.variable;
    return `<span class="${variableClass}">${escapeHtml(label)}</span>`;
  });
  return <div className={className} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(filled) }} />;
}

/** HTML that is already filled in (a generated letter, a preview from the API), sanitized first. */
export function SafeHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html?.trim()) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(toHtml(html)) }} />;
}

/**
 * A sent email as the student's mail app shows it: the API sends a whole document (its own backdrop,
 * card, brand bar and styles), so it gets a frame of its own, sized to its content. Sanitized first; the
 * sandbox runs no scripts, and links open in a new tab.
 */
export function EmailFrame({ html, title }: { html: string; title: string }) {
  const [height, setHeight] = useState(360);
  const doc = useMemo(
    () => `<base target="_blank">${DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true })}`,
    [html]
  );
  return (
    <iframe
      className={classes.emailFrame}
      srcDoc={doc}
      title={title}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ height }}
      // After images (the logo) have loaded, so the height is the final one.
      onLoad={(event) =>
        setHeight(event.currentTarget.contentDocument?.documentElement.scrollHeight ?? height)
      }
    />
  );
}

/** A file sent with an email, as a chip; opens it when clicked (a template preview has no file yet). */
export function AttachmentChip({
  name,
  hint,
  onClick,
}: {
  name: string;
  hint: string;
  onClick?: () => void;
}) {
  return (
    <UnstyledButton
      component={onClick ? "button" : "div"}
      className={classes.attachment}
      onClick={onClick}
      title={onClick ? `Open ${name}` : undefined}
    >
      <ThemeIcon size={34} radius="md" variant="light" color="red">
        <IconFileTypePdf size={18} />
      </ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={500} truncate>
          {name}
        </Text>
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      </div>
      {onClick && <IconExternalLink size={14} className={classes.attachmentOpen} />}
    </UnstyledButton>
  );
}

/**
 * A PDF in the browser's own viewer (zoom, pages, print), with a skeleton until it has loaded. Phones
 * may show only the first page here, so the view also offers Open in New Tab.
 */
export function PdfFrame({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [url]);
  return (
    <div className={classes.pdfFrame}>
      {!loaded && <Skeleton className={classes.pdfLoading} radius={0} />}
      <iframe src={`${url}#navpanes=0&view=FitH`} title={title} onLoad={() => setLoaded(true)} />
    </div>
  );
}

export interface IPreviewFact {
  icon: typeof IconFileText;
  label: string;
  value: ReactNode;
  hint?: ReactNode; // a dimmed line under the value
  color?: string; // the icon's colour: the step's state (gray when not given)
}

/**
 * The summary above a generated letter or a sent email: status badges with the actions on the right,
 * then a few facts (who made it, its approval, its delivery), each with an icon.
 * `flow` puts an arrow between the facts: steps done one after another (Generated → Approval → Email).
 */
export function PreviewSummary({
  badges,
  actions,
  facts,
  flow,
  children,
}: {
  badges: ReactNode;
  actions?: ReactNode;
  facts: IPreviewFact[];
  flow?: boolean;
  children?: ReactNode; // e.g. a rejection reason or the last error, under the facts
}) {
  return (
    <div className={classes.summary}>
      <Group justify="space-between" gap="sm" className={classes.summaryHead}>
        <Group gap="xs">{badges}</Group>
        {actions && <Group gap="xs">{actions}</Group>}
      </Group>
      <div className={`${classes.summaryFacts} ${classes.facts}`}>
        {facts.map(({ icon: Icon, label, value, hint, color = "gray" }, index) => (
          <Fragment key={label}>
            {flow && index > 0 && <IconChevronRight size={16} className={classes.factArrow} />}
            <Group gap="sm" wrap="nowrap" align="flex-start" className={classes.fact}>
              <ThemeIcon size={30} radius="md" variant="light" color={color}>
                <Icon size={16} />
              </ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
                <Text size="sm" fw={500} component="div">
                  {value}
                </Text>
                {hint && (
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-word" }}>
                    {hint}
                  </Text>
                )}
              </div>
            </Group>
          </Fragment>
        ))}
      </div>
      {children && (
        <div className={classes.summaryFacts} style={{ paddingTop: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}
