import { useEffect, useState } from "react";
import { SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconBuilding, IconHash, IconMail, IconUser } from "@tabler/icons-react";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import FormSection from "../components/FormSection";
import TempPasswordInput from "../components/TempPasswordInput";
import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "../lib/auth";
import { isAxiosError } from "axios";
import { getErrorMessage } from "../lib/errors";
import { NO_AUTOFILL, applyFormError, useResetOnOpen } from "../lib/forms";
import { ITenant, useCreateTenant, useUpdateTenant } from "../lib/platform";
import { isEmail } from "../lib/utils";
import ShareLoginDetails, { ILoginDetails } from "./ShareLoginDetails";

// The admin's fields come back from the API as admin.name etc.
const ADMIN_FIELDS = {
  "admin.name": "adminName",
  "admin.email": "adminEmail",
  "admin.password": "adminPassword",
} as const;

const empty = { name: "", code: "", contactEmail: "", adminName: "", adminEmail: "", adminPassword: "" };

/**
 * New tenant (with its first Super Admin) or edit one (name, code, contact email). After a create,
 * the admin's login details are shown once to pass on.
 */
export default function TenantForm({
  opened,
  tenant,
  onClose,
}: {
  opened: boolean;
  tenant: ITenant | null; // null = a new one
  onClose: () => void;
}) {
  const create = useCreateTenant();
  const update = useUpdateTenant();
  const isNew = !tenant;
  const [created, setCreated] = useState<ILoginDetails | null>(null);

  const form = useForm({
    initialValues: empty,
    validate: {
      name: (value) => (value.trim() ? null : "Institution name is required"),
      code: (value) => (!value || /^[A-Z0-9-]{2,20}$/.test(value) ? null : "Use 2 to 20 of A-Z, 0-9 or -"),
      contactEmail: (value) => (!value.trim() || isEmail(value) ? null : "Enter a valid email"),
      adminName: (value) => (!isNew || value.trim() ? null : "The admin's name is required"),
      adminEmail: (value) => (!isNew || isEmail(value) ? null : "Enter a valid email"),
      adminPassword: (value) =>
        !isNew || (value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX)
          ? null
          : `Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
    },
  });

  useResetOnOpen(
    form,
    opened,
    tenant ?? "new",
    tenant
      ? { ...empty, name: tenant.name, code: tenant.code ?? "", contactEmail: tenant.contactEmail ?? "" }
      : empty
  );
  useEffect(() => {
    if (opened) setCreated(null);
  }, [opened]);

  const handleSubmit = form.onSubmit((values) => {
    const details = {
      name: values.name.trim(),
      code: values.code.trim(),
      contactEmail: values.contactEmail.trim(),
    };
    if (tenant) {
      update.mutate(
        { id: tenant.id, ...details },
        {
          onSuccess: (saved) => {
            notifications.show({ color: "green", title: "Tenant updated", message: saved.name });
            onClose();
          },
          onError: (error) =>
            applyFormError(form, error, { conflictField: "code", toastTitle: "Could not save tenant" }),
        }
      );
      return;
    }
    create.mutate(
      {
        ...details,
        admin: {
          name: values.adminName.trim(),
          email: values.adminEmail.trim(),
          password: values.adminPassword,
        },
      },
      {
        onSuccess: (saved) => {
          const admin = saved.users?.find(({ email }) => email === values.adminEmail.trim().toLowerCase());
          notifications.show({ color: "green", title: "Tenant created", message: saved.name });
          setCreated({
            id: admin?.id ?? 0,
            name: values.adminName.trim(),
            email: values.adminEmail.trim(),
            password: values.adminPassword,
            company: saved.name,
            tenantId: saved.id,
          });
        },
        // 409: the code or the admin's email is taken; 422 admin fields come as admin.email etc.
        onError: (error) => {
          if (isAxiosError(error) && error.response?.status === 409) {
            form.setFieldError(
              /code/i.test(getErrorMessage(error)) ? "code" : "adminEmail",
              getErrorMessage(error)
            );
            return;
          }
          applyFormError(form, error, { fieldMap: ADMIN_FIELDS, toastTitle: "Could not create tenant" });
        },
      }
    );
  });

  if (created) {
    return (
      <FormModal
        opened={opened}
        onClose={onClose}
        title="Tenant Created"
        description={`Share these login details with ${created.name}, the Super Admin of ${created.company}.`}
      >
        <ShareLoginDetails details={created} onDone={onClose} />
      </FormModal>
    );
  }

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={600}
      title={isNew ? "New Tenant" : "Edit Tenant"}
      description={isNew ? "A client institution with its first Super Admin." : tenant.name}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <FormSection title="Institution">
            <TextInput
              label="Institution Name"
              placeholder="e.g. Apex Study Abroad"
              withAsterisk
              maxLength={150}
              leftSection={<IconBuilding size={16} />}
              data-autofocus
              {...form.getInputProps("name")}
            />
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <TextInput
                label="Code"
                placeholder="e.g. APEX"
                maxLength={20}
                leftSection={<IconHash size={16} />}
                {...form.getInputProps("code")}
                onChange={(e) => form.setFieldValue("code", e.currentTarget.value.toUpperCase())}
              />
              <TextInput
                label="Contact Email"
                type="email"
                placeholder="e.g. office@apex.com"
                leftSection={<IconMail size={16} />}
                {...form.getInputProps("contactEmail")}
              />
            </SimpleGrid>
          </FormSection>

          {isNew && (
            <FormSection title="First Super Admin">
              <Text size="xs" c="dimmed" mt={-8}>
                They log in with this email and password, then add the institution&apos;s other users.
              </Text>
              <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <TextInput
                  label="Full Name"
                  placeholder="e.g. Riya Kapoor"
                  withAsterisk
                  maxLength={NAME_MAX}
                  leftSection={<IconUser size={16} />}
                  {...NO_AUTOFILL}
                  {...form.getInputProps("adminName")}
                />
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="e.g. riya@apex.com"
                  withAsterisk
                  leftSection={<IconMail size={16} />}
                  {...NO_AUTOFILL}
                  {...form.getInputProps("adminEmail")}
                />
              </SimpleGrid>
              <TempPasswordInput
                onGenerate={(password) => form.setFieldValue("adminPassword", password)}
                {...form.getInputProps("adminPassword")}
              />
            </FormSection>
          )}

          <FormActions
            onCancel={onClose}
            submitLabel={isNew ? "Create Tenant" : "Save Changes"}
            loading={create.isPending || update.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}
