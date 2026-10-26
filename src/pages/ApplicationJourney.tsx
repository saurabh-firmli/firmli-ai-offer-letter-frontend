import { ReactNode } from "react";
import { Button, Card, Group, Loader, Stepper, Text, ThemeIcon } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCircleCheck,
  IconEdit,
  IconGavel,
  IconMail,
  IconRobot,
  IconX,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { IApplication } from "../lib/applications";
import { useCan } from "../lib/auth";
import { letterTypeLabels } from "../lib/letterTemplates";
import { formatDate } from "../lib/utils";
import { RO_MANUAL_REVIEW, editApplicationPath } from "../routes";

/*
 * Where an application stands, in two parts: the journey (Submitted → AI Assessment → Decision →
 * Letter → Emailed) and the one next step someone should take, with a button that goes there.
 */

export type TApplicationTab = "overview" | "assessment" | "documents" | "letter" | "notes" | "activity";

type TStepState = "done" | "current" | "error" | "todo";

interface IStep {
  label: string;
  description: string;
  state: TStepState;
  running?: boolean;
}

// The outcome words are the letter types: Conditional Offer, Rejection, Manual Review.
const OUTCOME_WORDS: Record<string, string> = letterTypeLabels;

/** The steps of this application, each done / current / failed / to come. */
function journeySteps(app: IApplication, showLetter: boolean, showEmail: boolean): IStep[] {
  const decided = app.status === "completed";
  const letter = app.letter;
  const steps: IStep[] = [
    {
      label: "Submitted",
      description: app.submittedAt ? formatDate(app.submittedAt) : "Draft",
      state: app.status === "draft" ? "current" : "done",
    },
    {
      label: "AI Assessment",
      description:
        app.assessmentStatus === "completed"
          ? app.confidence !== null
            ? `Done · ${Math.round(app.confidence * 100)}% sure`
            : "Done"
          : app.assessmentStatus === "in_progress"
            ? "Running…"
            : app.assessmentStatus === "failed"
              ? "Failed"
              : app.assessmentStatus === "pending"
                ? "Waiting to run"
                : "After submit",
      state:
        app.assessmentStatus === "completed"
          ? "done"
          : app.assessmentStatus === "failed"
            ? "error"
            : app.assessmentStatus
              ? "current"
              : "todo",
      running: app.assessmentStatus === "in_progress",
    },
    {
      label: "Decision",
      description: decided
        ? `${OUTCOME_WORDS[app.outcome ?? ""] ?? "Decided"} · ${app.decision?.source === "manual" ? (app.decision.by?.name ?? "A person") : "AI"}`
        : app.status === "manual_review"
          ? "Needs a person"
          : "After the assessment",
      state: decided ? "done" : app.status === "manual_review" ? "current" : "todo",
    },
  ];
  if (showLetter) {
    steps.push({
      label: "Letter",
      description: !letter
        ? decided
          ? "Not generated"
          : "After the decision"
        : letter.status === "approved"
          ? "Approved"
          : letter.status === "rejected"
            ? "Rejected"
            : "Waiting for approval",
      state: !letter
        ? decided
          ? "current"
          : "todo"
        : letter.status === "approved"
          ? "done"
          : letter.status === "rejected"
            ? "error"
            : "current",
    });
  }
  if (showEmail) {
    const status = letter?.status === "approved" ? letter.emailStatus : undefined;
    steps.push({
      label: "Emailed",
      description:
        status === "sent"
          ? "Sent to the student"
          : status === "failed"
            ? "Failed"
            : status === "retrying" || status === "sending"
              ? "Sending…"
              : letter?.status === "approved"
                ? "Not sent yet"
                : "After approval",
      state:
        status === "sent"
          ? "done"
          : status === "failed"
            ? "error"
            : letter?.status === "approved"
              ? "current"
              : "todo",
      running: status === "retrying" || status === "sending",
    });
  }
  return steps;
}

/** The journey as a stepper: done steps ticked, the current one highlighted, a failed one red. */
export function ApplicationJourney({ application }: { application: IApplication }) {
  const can = useCan();
  const compact = useMediaQuery("(max-width: 62em)");
  const steps = journeySteps(
    application,
    can("letters", "read"),
    can("letters", "read") && can("communications", "read")
  );
  const active = steps.findIndex(({ state }) => state !== "done");

  return (
    <Card withBorder radius="lg" shadow="xs" padding="lg">
      <Stepper
        active={active < 0 ? steps.length : active}
        size="sm"
        orientation={compact ? "vertical" : "horizontal"}
        allowNextStepsSelect={false}
      >
        {steps.map(({ label, description, state, running }) => (
          <Stepper.Step
            key={label}
            label={label}
            description={description}
            color={state === "error" ? "red" : undefined}
            icon={state === "error" ? <IconX size={16} /> : undefined}
            loading={running}
          />
        ))}
      </Stepper>
    </Card>
  );
}

interface INextStep {
  color: string;
  icon: ReactNode;
  title: string;
  text: string;
  action?: { label: string; tab?: TApplicationTab; to?: string };
}

/** The one thing to do now, from the application's state (and what the user may do). */
function nextStep(app: IApplication, can: ReturnType<typeof useCan>): INextStep {
  const outcome = OUTCOME_WORDS[app.outcome ?? ""];
  if (app.status === "draft") {
    return {
      color: "gray",
      icon: <IconEdit size={18} />,
      title: "Finish the draft and submit it",
      text: "A draft isn't checked by the AI until it is submitted.",
      action: can("applications", "update")
        ? { label: "Continue Editing", to: editApplicationPath(app.id) }
        : undefined,
    };
  }
  if (app.assessmentStatus === "in_progress" || app.status === "processing") {
    return {
      color: "violet",
      icon: <Loader size={16} color="violet" />,
      title: "The AI is assessing this application",
      text: "It reads the documents and checks the rules: usually 10–60 seconds, longer when many are queued. This page updates by itself.",
      action: { label: "Watch Progress", tab: "assessment" },
    };
  }
  if (app.assessmentStatus === "failed") {
    return {
      color: "red",
      icon: <IconAlertTriangle size={18} />,
      title: "The AI assessment failed",
      text: "See why on the Assessment tab, fix it (e.g. the OpenAI key), then run it again.",
      action: { label: "Open Assessment", tab: "assessment" },
    };
  }
  if (app.status === "submitted") {
    return {
      color: "primary",
      icon: <IconRobot size={18} />,
      title: "Run the AI assessment",
      text: "With Automatic assessment on (Settings) it starts by itself; otherwise start it here.",
      action: { label: "Open Assessment", tab: "assessment" },
    };
  }
  if (app.status === "manual_review") {
    return {
      color: "orange",
      icon: <IconGavel size={18} />,
      title: "A person needs to decide",
      text: "The AI couldn't decide alone. Review the case in the Manual Review Queue: approve, reject or ask for documents.",
      action: can("reviews", "read")
        ? { label: "Open in Manual Review", to: `${RO_MANUAL_REVIEW}?search=${app.applicationNumber}` }
        : undefined,
    };
  }
  // Decided: the letter, then the email.
  const letter = app.letter;
  const decided = `Decided: ${outcome ?? "done"}.`;
  if (!can("letters", "read")) {
    return {
      color: "green",
      icon: <IconCircleCheck size={18} />,
      title: decided,
      text: "Nothing else to do here.",
    };
  }
  if (!letter) {
    return {
      color: "primary",
      icon: <IconArrowRight size={18} />,
      title: "Generate the letter",
      text: `${decided} Next, the ${outcome ?? ""} letter for the student.`,
      action: { label: "Open Letter", tab: "letter" },
    };
  }
  if (letter.status === "pending_approval") {
    return {
      color: "orange",
      icon: <IconArrowRight size={18} />,
      title: "Approve the letter",
      text: `${letter.referenceNumber} is waiting for someone to check and approve it.`,
      action: { label: "Review Letter", tab: "letter" },
    };
  }
  if (letter.status === "rejected") {
    return {
      color: "red",
      icon: <IconAlertTriangle size={18} />,
      title: "The letter was rejected",
      text: "Fix the template or the application, then generate it again.",
      action: { label: "Open Letter", tab: "letter" },
    };
  }
  // Without the Communications permission, an approved letter is as far as this page goes.
  if (letter.status === "approved" && !can("communications", "read")) {
    return {
      color: "green",
      icon: <IconCircleCheck size={18} />,
      title: "Letter approved",
      text: `${letter.referenceNumber} is ready.`,
    };
  }
  if (letter.emailStatus === "sent") {
    return {
      color: "green",
      icon: <IconCircleCheck size={18} />,
      title: "All done",
      text: `The ${outcome ?? ""} letter was emailed to the student.`,
      action: { label: "See Emails", tab: "letter" },
    };
  }
  if (letter.emailStatus === "failed") {
    return {
      color: "red",
      icon: <IconMail size={18} />,
      title: "The email to the student failed",
      text: "See the error, then retry it or send it again.",
      action: { label: "Open Emails", tab: "letter" },
    };
  }
  if (letter.emailStatus === "retrying" || letter.emailStatus === "sending") {
    return {
      color: "orange",
      icon: <IconMail size={18} />,
      title: "The email is being sent",
      text: "A failed try is retried by itself.",
      action: { label: "Open Emails", tab: "letter" },
    };
  }
  return {
    color: "primary",
    icon: <IconMail size={18} />,
    title: "Email the letter to the student",
    text: `${letter.referenceNumber} is approved and ready to send.`,
    action: { label: "Send Email", tab: "letter" },
  };
}

/** The next step, as a strip with its button: a tab of this page, or another page. */
export function NextStep({
  application,
  onOpenTab,
}: {
  application: IApplication;
  onOpenTab: (tab: TApplicationTab) => void;
}) {
  const can = useCan();
  const step = nextStep(application, can);
  return (
    <Card
      withBorder
      radius="lg"
      padding="md"
      style={{
        borderColor: `var(--mantine-color-${step.color}-3)`,
        backgroundColor: `var(--mantine-color-${step.color}-0)`,
      }}
    >
      <Group justify="space-between" gap="md" wrap="wrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: "1 1 320px" }}>
          <ThemeIcon size={36} radius="md" variant="light" color={step.color}>
            {step.icon}
          </ThemeIcon>
          <div>
            <Text size="xs" fw={700} tt="uppercase" c={`${step.color}.7`} lts={0.4}>
              Next step
            </Text>
            <Text fw={600}>{step.title}</Text>
            <Text size="sm" c="dimmed">
              {step.text}
            </Text>
          </div>
        </Group>
        {step.action &&
          (step.action.to ? (
            <Button component={Link} to={step.action.to} rightSection={<IconArrowRight size={16} />}>
              {step.action.label}
            </Button>
          ) : (
            <Button
              variant={step.color === "green" ? "secondary" : "primary"}
              rightSection={<IconArrowRight size={16} />}
              onClick={() => onOpenTab(step.action!.tab!)}
            >
              {step.action.label}
            </Button>
          ))}
      </Group>
    </Card>
  );
}
