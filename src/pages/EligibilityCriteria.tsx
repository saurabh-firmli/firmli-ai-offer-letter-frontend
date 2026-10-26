import { useState } from "react";
import { Badge, Button, Card, Group, SimpleGrid, Text, TextInput, ThemeIcon } from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { IconListCheck, IconPlus, IconSchool, IconSearch } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router";
import DataState from "../components/DataState";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import { CardSkeleton } from "../components/Skeletons";
import { useCan } from "../lib/auth";
import { IEligibilitySetSummary, useEligibilitySets } from "../lib/eligibility";
import { formatRelative } from "../lib/utils";
import { eligibilitySetPath } from "../routes";
import EligibilitySetForm from "./EligibilitySetForm";
import classes from "./EligibilitySetDetail.module.css";
import { NO_AUTOFILL } from "../lib/forms";

/** One set: name and description, which version is live or drafted, and how many programs use it. */
function SetCard({ set }: { set: IEligibilitySetSummary }) {
  return (
    <Card
      component={Link}
      to={eligibilitySetPath(set.id)}
      withBorder
      radius="lg"
      shadow="xs"
      padding="lg"
      className={classes.setCard}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon size={40} radius="md" variant="light" color="primary">
          <IconListCheck size={22} />
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text fw={700} truncate>
            {set.name}
          </Text>
          <Text size="sm" c="dimmed" lineClamp={2} mih={44}>
            {set.description || "No description"}
          </Text>
        </div>
      </Group>

      <Group gap={6} mt="md" mb="md">
        <Badge variant="light" color={set.publishedVersion ? "green" : "gray"}>
          {set.publishedVersion ? `v${set.publishedVersion} live` : "Not published"}
        </Badge>
        {set.draftVersion && (
          <Badge variant="outline" color="primary">
            v{set.draftVersion} draft
          </Badge>
        )}
      </Group>

      <Group justify="space-between" gap="xs" className={classes.setCardFooter}>
        <Group gap={6} wrap="nowrap">
          <IconSchool size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c={set.programCount ? undefined : "dimmed"}>
            {set.programCount
              ? `${set.programCount} ${set.programCount === 1 ? "program" : "programs"}`
              : "No programs yet"}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          Updated {formatRelative(set.updatedAt)}
        </Text>
      </Group>
    </Card>
  );
}

const GRID = { base: 1, sm: 2, lg: 3 };

/** Eligibility sets as cards; a card opens the set on its own page. */
export default function EligibilityCriteria() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [setFormOpened, setForm] = useDisclosure();
  const can = useCan();
  const navigate = useNavigate();
  const sets = useEligibilitySets(debouncedSearch);

  return (
    <Page>
      <PageHeader
        title="Eligibility Criteria"
        description="Admission rules, kept in versioned sets that programs share."
        action={
          can("eligibility", "create") && (
            <Button leftSection={<IconPlus size={16} />} onClick={setForm.open}>
              New Eligibility Set
            </Button>
          )
        }
      />

      <TextInput
        placeholder="Search sets"
        {...NO_AUTOFILL}
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        w={{ base: "100%", sm: 320 }}
      />

      <DataState
        isLoading={sets.isLoading}
        skeleton={
          <SimpleGrid cols={GRID} spacing="lg">
            {Array.from({ length: 4 }, (_, i) => (
              <Card key={i} withBorder radius="lg" shadow="xs" padding="lg">
                <CardSkeleton />
              </Card>
            ))}
          </SimpleGrid>
        }
        error={sets.error}
        errorTitle="Could not load sets"
        isEmpty={!sets.data?.length}
        emptyIcon={IconListCheck}
        emptyTitle={debouncedSearch ? "No sets match your search" : "No eligibility sets yet"}
        emptyText={debouncedSearch ? undefined : "Create a set, add its criteria, then publish it."}
      >
        <SimpleGrid cols={GRID} spacing="lg">
          {sets.data?.map((set) => (
            <SetCard key={set.id} set={set} />
          ))}
        </SimpleGrid>
      </DataState>

      {/* A new set opens right away, on its empty draft v1. */}
      <EligibilitySetForm
        opened={setFormOpened}
        set={null}
        onClose={setForm.close}
        onSaved={(saved) => navigate(eligibilitySetPath(saved.id))}
      />
    </Page>
  );
}
