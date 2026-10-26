import { Anchor, PasswordInput, PasswordInputProps } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconLock } from "@tabler/icons-react";
import { PASSWORD_MAX, PASSWORD_MIN } from "../lib/auth";
import { generatePassword } from "../lib/users";

/**
 * The temporary password of a new user, with "Generate one" (which also shows it, so it can be
 * shared). Spread form.getInputProps(...) on it and pass onGenerate to set the field.
 */
export default function TempPasswordInput({
  onGenerate,
  hint = "Share it with them; they can change it after logging in.",
  ...props
}: PasswordInputProps & { onGenerate: (password: string) => void; hint?: string }) {
  const [visible, { open, toggle }] = useDisclosure();
  return (
    <PasswordInput
      label="Temporary Password"
      placeholder={`At least ${PASSWORD_MIN} characters`}
      withAsterisk
      maxLength={PASSWORD_MAX}
      leftSection={<IconLock size={16} />}
      visible={visible}
      onVisibilityChange={toggle}
      description={
        <>
          {hint}{" "}
          <Anchor
            component="button"
            type="button"
            size="xs"
            onClick={() => {
              onGenerate(generatePassword());
              open();
            }}
          >
            Generate one
          </Anchor>
        </>
      }
      {...props}
    />
  );
}
