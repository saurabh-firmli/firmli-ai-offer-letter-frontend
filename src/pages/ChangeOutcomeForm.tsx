import { useEffect, useState } from "react";
import { Alert, Stack, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCircleCheck, IconCircleX, IconInfoCircle } from "@tabler/icons-react";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import OptionCards from "../components/OptionCards";
import { IApplication, useChangeOutcome } from "../lib/applications";
import errorHandler from "../lib/errors";
import { applyFormErrorMessages } from "../lib/forms";

const REASON_MAX = 2000;
type TDecided = "conditional_offer" | "rejection";

const OUTCOMES = [
  { value: "conditional_offer", label: "Conditional Offer", icon: <IconCircleCheck size={16} /> },
  { value: "rejection", label: "Rejection", icon: <IconCircleX size={16} /> },
];

/**
 * Change outcome on a decided application, e.g. to withdraw an offer. Needs a reason; the earlier
 * outcome stays in the Activity tab and the audit log.
 */
export default function ChangeOutcomeForm({
  application,
  onClose,
}: {
  application: IApplication | null; // null = closed
  onClose: () => void;
}) {
  const change = useChangeOutcome();
  const [outcome, setOutcome] = useState<TDecided>("rejection");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ outcome?: string; reason?: string }>({});

  // Start on the other outcome: that is what a change is for.
  useEffect(() => {
    if (!application) return;
    setOutcome(application.outcome === "rejection" ? "conditional_offer" : "rejection");
    setReason("");
    setErrors({});
  }, [application]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!application) return;
    if (!reason.trim()) {
      setErrors({ reason: "Give the reason for the change" });
      return;
    }
    change.mutate(
      { id: application.id, outcome, reason: reason.trim() },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: "green",
            title: "Outcome changed",
            message: `${saved.applicationNumber} · ${OUTCOMES.find(({ value }) => value === outcome)?.label}`,
          });
          onClose();
        },
        onError: (error) =>
          applyFormErrorMessages(error, {
            outcome: (message) => setErrors((current) => ({ ...current, outcome: message ?? undefined })),
            reason: (message) => setErrors((current) => ({ ...current, reason: message ?? undefined })),
          }) || errorHandler(error, "Could not change the outcome"),
      }
    );
  };

  return (
    <FormModal
      opened={Boolean(application)}
      onClose={onClose}
      title="Change Outcome"
      description={
        application ? `${application.applicationNumber} · ${application.student.fullName}` : undefined
      }
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
            The application keeps its history: the earlier outcome stays in its activity and the audit log.
          </Alert>
          <OptionCards
            label="New Outcome"
            required
            data={OUTCOMES}
            value={outcome}
            onChange={(value) => {
              setOutcome(value as TDecided);
              setErrors((current) => ({ ...current, outcome: undefined }));
            }}
            error={errors.outcome}
          />
          <Textarea
            label="Reason"
            withAsterisk
            placeholder="e.g. Transcript found to be forged"
            autosize
            minRows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => {
              setReason(event.currentTarget.value);
              setErrors((current) => ({ ...current, reason: undefined }));
            }}
            error={errors.reason}
          />
          <FormActions onCancel={onClose} submitLabel="Change Outcome" loading={change.isPending} />
        </Stack>
      </form>
    </FormModal>
  );
}
