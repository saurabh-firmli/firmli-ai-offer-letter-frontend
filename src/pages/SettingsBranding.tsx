import { useRef, useState } from "react";
import {
  Button,
  ColorInput,
  ColorInputProps,
  ColorSwatch,
  FileButton,
  Group,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconPhotoUp, IconTrash, IconUpload } from "@tabler/icons-react";
import { confirmDanger } from "../components/confirm";
import errorHandler from "../lib/errors";
import { applyFormErrorMessages } from "../lib/forms";
import {
  DEFAULT_BRAND_COLOR,
  ISettings,
  LOGO_MAX_MB,
  LOGO_TYPES,
  useRemoveLogo,
  useUploadLogo,
} from "../lib/settings";
import classes from "./Settings.module.css";

// A few colours to start from, one click each; any #RRGGBB can be typed or picked below them.
const SWATCHES = [
  DEFAULT_BRAND_COLOR,
  "#0F766E",
  "#15803D",
  "#9F1239",
  "#6D28D9",
  "#C2410C",
  "#334155",
  "#111827",
];

export const isBrandColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

interface ILetterheadDetails {
  name: string;
  address: string;
  website: string;
  contactEmail: string;
  phone: string;
}

/**
 * The top of a new letter as the PDF prints it, on a page: the logo on the left (or the name in the
 * brand colour), the institution's details on the right, a line, then a heading, text and a table
 * header in the brand colour. Follows the form as it is typed.
 */
function LetterheadPreview({
  logoUrl,
  color,
  details,
}: {
  logoUrl: string | null;
  color: string;
  details: ILetterheadDetails;
}) {
  const name = details.name.trim() || "Your institution";
  const lines = [
    details.address,
    details.website,
    [details.contactEmail.trim(), details.phone.trim()].filter(Boolean).join(" · "),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    <div className={classes.previewBackdrop}>
      <div className={classes.previewPage} aria-label="Letterhead preview">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="lg">
          {logoUrl ? (
            <img src={logoUrl} alt={`${name} logo`} className={classes.letterheadLogo} />
          ) : (
            <Text fw={700} fz={17} lh={1.3} style={{ color }}>
              {name}
            </Text>
          )}
          <div className={classes.letterheadDetails}>
            {logoUrl && <div className={classes.letterheadName}>{name}</div>}
            {lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </Group>
        <div className={classes.letterheadRule} style={{ backgroundColor: color }} />
        <Text fw={700} size="sm" style={{ color }}>
          Conditional Offer of Admission
        </Text>
        {/* Stand-in text and a table header, to show where the colour goes. */}
        <div className={classes.previewText} style={{ width: "92%" }} />
        <div className={classes.previewText} style={{ width: "70%" }} />
        <div className={classes.previewTable} style={{ backgroundColor: color }}>
          <span>Requirement</span>
          <span>Required standard</span>
          <span>Fulfilled</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Branding on the Settings page: the logo (uploaded at once, on its own endpoint) and the brand colour
 * (saved with the form). Letters made before a change keep how they looked.
 */
export default function BrandingFields({
  logo,
  details,
  colorProps,
  canEdit,
}: {
  logo: ISettings["logo"];
  details: ILetterheadDetails;
  colorProps: ColorInputProps;
  canEdit: boolean;
}) {
  const upload = useUploadLogo();
  const remove = useRemoveLogo();
  const [logoError, setLogoError] = useState<string | null>(null);
  const resetRef = useRef<() => void>(null);
  const typed = String(colorProps.value ?? "");
  const color = isBrandColor(typed) ? typed : DEFAULT_BRAND_COLOR;
  const institution = details.name.trim() || "your institution";

  const handleFile = (file: File | null) => {
    resetRef.current?.(); // the same file can be picked again after an error
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setLogoError("Upload a PNG or JPG image");
    if (file.size > LOGO_MAX_MB * 1024 * 1024)
      return setLogoError(`The file must be at most ${LOGO_MAX_MB} MB`);
    setLogoError(null);
    upload.mutate(file, {
      onSuccess: () =>
        notifications.show({
          color: "green",
          title: logo ? "Logo replaced" : "Logo uploaded",
          message: institution,
        }),
      onError: (error) =>
        applyFormErrorMessages(error, { file: setLogoError }) ||
        errorHandler(error, "Could not upload the logo"),
    });
  };

  const handleRemove = () =>
    confirmDanger({
      title: "Remove the logo?",
      message: `New letters will show ${institution}'s name in the brand colour instead. Letters made before keep the logo.`,
      confirmLabel: "Remove Logo",
      onConfirm: () =>
        remove.mutate(undefined, {
          onSuccess: () =>
            notifications.show({ color: "green", title: "Logo removed", message: institution }),
          onError: (error) => errorHandler(error, "Could not remove the logo"),
        }),
    });

  const pickColor = (value: string) => colorProps.onChange?.(value);

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
        <div>
          <Text size="sm" fw={500}>
            Logo
          </Text>
          <Text size="xs" c="dimmed" mb={8}>
            PNG or JPG, at most {LOGO_MAX_MB} MB. A wide logo on a transparent background looks best.
          </Text>
          <FileButton
            onChange={handleFile}
            accept={LOGO_TYPES.join(",")}
            resetRef={resetRef}
            disabled={!canEdit}
          >
            {(props) => (
              <UnstyledButton
                {...props}
                className={classes.logoDrop}
                disabled={!canEdit || upload.isPending}
                aria-label={logo ? "Replace logo" : "Upload logo"}
              >
                {logo ? (
                  <img src={logo.url} alt={`${institution} logo`} />
                ) : (
                  <Stack gap={4} align="center">
                    <IconPhotoUp size={22} color="var(--mantine-color-dimmed)" aria-hidden />
                    <Text size="xs" c="dimmed">
                      {upload.isPending
                        ? "Uploading..."
                        : canEdit
                          ? "Click to upload your logo"
                          : "No logo yet"}
                    </Text>
                  </Stack>
                )}
              </UnstyledButton>
            )}
          </FileButton>
          {canEdit && logo && (
            <Group gap="xs" mt={8}>
              <FileButton
                onChange={handleFile}
                accept={LOGO_TYPES.join(",")}
                // resetRef only empties the logo box's input: empty this one on each click.
                inputProps={{ onClick: (event) => (event.currentTarget.value = "") }}
              >
                {(props) => (
                  <Button
                    {...props}
                    size="xs"
                    variant="secondary"
                    leftSection={<IconUpload size={14} />}
                    loading={upload.isPending}
                  >
                    Replace
                  </Button>
                )}
              </FileButton>
              <Button
                size="xs"
                variant="secondary"
                color="red"
                leftSection={<IconTrash size={14} />}
                loading={remove.isPending}
                onClick={handleRemove}
              >
                Remove
              </Button>
            </Group>
          )}
          {logoError && (
            <Text size="xs" c="red" mt={6}>
              {logoError}
            </Text>
          )}
        </div>

        <div>
          <Text size="sm" fw={500}>
            Brand Colour
          </Text>
          <Text size="xs" c="dimmed" mb={8}>
            The line under the letterhead, headings and table headers.
          </Text>
          <Group gap={8} mb={10} role="radiogroup" aria-label="Brand colour">
            {SWATCHES.map((swatch) => {
              const selected = color.toUpperCase() === swatch;
              return (
                <ColorSwatch
                  key={swatch}
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={swatch === DEFAULT_BRAND_COLOR ? `${swatch} (Firmli navy)` : swatch}
                  color={swatch}
                  size={28}
                  disabled={!canEdit}
                  onClick={() => pickColor(swatch === DEFAULT_BRAND_COLOR ? "" : swatch)}
                  className={classes.swatch}
                  data-selected={selected || undefined}
                >
                  {selected && <IconCheck size={14} color="white" stroke={3} />}
                </ColorSwatch>
              );
            })}
          </Group>
          <ColorInput
            aria-label="Custom colour"
            placeholder={`${DEFAULT_BRAND_COLOR} (Firmli navy)`}
            format="hex"
            disabled={!canEdit}
            {...colorProps}
          />
        </div>
      </SimpleGrid>

      <div>
        <Text size="sm" fw={500}>
          Preview
        </Text>
        <Text size="xs" c="dimmed" mb={8}>
          The top of every new letter. It follows your details above as you type.
        </Text>
        <LetterheadPreview logoUrl={logo?.url ?? null} color={color} details={details} />
      </div>
    </>
  );
}
