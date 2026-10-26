import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconCopy,
  IconFileText,
  IconListCheck,
  IconLock,
  IconPencil,
  IconPlus,
  IconRocket,
  IconSchool,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import DataState from "../components/DataState";
import RecordUnavailable from "../components/RecordUnavailable";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import RowActions from "../components/RowActions";
import { CardSkeleton } from "../components/Skeletons";
import StatusDot from "../components/StatusDot";
import { confirmDanger } from "../components/confirm";
import { useCan } from "../lib/auth";
import {
  ICriterion,
  IDocumentRequirement,
  IEligibilityOptions,
  IVersionSummary,
  formatRule,
  ruleParts,
  useDeleteCriterion,
  useDeleteDocument,
  useDeleteSet,
  useDiscardDraft,
  useEligibilityOptions,
  useEligibilitySet,
  useEligibilityVersion,
  useNewVersion,
  usePublishVersion,
  useReorderCriteria,
  useSaveDocument,
  versionLabel,
  versionStatusColors,
  versionStatusLabels,
} from "../lib/eligibility";
import errorHandler from "../lib/errors";
import { formatDate } from "../lib/utils";
import { RO_ELIGIBILITY_CRITERIA } from "../routes";
import AssignProgramsForm from "./AssignProgramsForm";
import CriterionForm from "./CriterionForm";
import DocumentRequirementForm from "./DocumentRequirementForm";
import DuplicateVersionForm from "./DuplicateVersionForm";
import EligibilitySetForm from "./EligibilitySetForm";
import classes from "./EligibilitySetDetail.module.css";

const TABS = ["rules", "documents", "programs", "versions"] as const;
type TTab = (typeof TABS)[number];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** A rule as chips: "≥ 3.0 GPA", "between 6.0 – 9.0", "one of" UK · Ireland; the full sentence on hover. */
function RuleChips({
  criterion,
  options,
}: {
  criterion: ICriterion;
  options: IEligibilityOptions | undefined;
}) {
  const { symbol, word, values, unit } = ruleParts(criterion, options);
  return (
    <Tooltip label={formatRule(criterion, options)}>
      <Group gap={6}>
        {word && (
          <Text size="sm" c="dimmed">
            {word}
          </Text>
        )}
        {values.map((value) => (
          <Badge key={value} variant="light" color="primary" radius="sm" size="lg" fw={600}>
            {symbol && `${symbol} `}
            {value}
            {unit && ` ${unit}`}
          </Badge>
        ))}
      </Group>
    </Tooltip>
  );
}

/** One line of a rule's details: a small icon and text. */
function Meta({ icon: Icon, children }: { icon: typeof IconFileText; children: React.ReactNode }) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <Icon size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0, marginTop: 3 }} />
      <Text size="xs" c="dimmed">
        {children}
      </Text>
    </Group>
  );
}

/** A rule as a card: number and name, the rule as chips, then what the AI checks and when. */
function RuleCard({
  criterion,
  number,
  options,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  criterion: ICriterion;
  number: number;
  options: IEligibilityOptions | undefined;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void; // undefined = can't move that way (or not a draft)
  onMoveDown?: () => void;
}) {
  const reorderable = onMoveUp || onMoveDown;
  const dates =
    criterion.effectiveDate || criterion.expiryDate
      ? `${criterion.effectiveDate ? `From ${formatDate(criterion.effectiveDate)}` : "Until"}${
          criterion.expiryDate
            ? `${criterion.effectiveDate ? " until " : " "}${formatDate(criterion.expiryDate)}`
            : ""
        }`
      : null;

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
        <Group gap="sm" wrap="nowrap" miw={0}>
          <ThemeIcon size={28} radius="xl" variant="light" color="gray">
            <Text size="xs" fw={700}>
              {number}
            </Text>
          </ThemeIcon>
          <Text fw={600} truncate>
            {criterion.name}
          </Text>
        </Group>
        <Group gap={4} wrap="nowrap">
          <Badge variant="light" color={criterion.isMandatory ? "primary" : "gray"}>
            {criterion.isMandatory ? "Mandatory" : "Optional"}
          </Badge>
          {reorderable && (
            <>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Move ${criterion.name} up`}
                disabled={!onMoveUp}
                onClick={onMoveUp}
              >
                <IconArrowUp size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Move ${criterion.name} down`}
                disabled={!onMoveDown}
                onClick={onMoveDown}
              >
                <IconArrowDown size={16} />
              </ActionIcon>
            </>
          )}
          {(onEdit || onDelete) && <RowActions name={criterion.name} onEdit={onEdit} onDelete={onDelete} />}
        </Group>
      </Group>

      <Stack gap={8} mt="sm" className={classes.ruleBody}>
        <RuleChips criterion={criterion} options={options} />
        {criterion.description && (
          <Text size="sm" c="dimmed">
            {criterion.description}
          </Text>
        )}
        {(criterion.documentTypes.length > 0 || criterion.rejectionReason || dates) && (
          <Stack gap={4}>
            {criterion.documentTypes.length > 0 && (
              <Meta icon={IconFileText}>
                Checked on {criterion.documentTypes.map(({ label }) => label).join(", ")}
              </Meta>
            )}
            {criterion.rejectionReason && (
              <Meta icon={IconAlertTriangle}>If not met: {criterion.rejectionReason}</Meta>
            )}
            {dates && <Meta icon={IconCalendar}>{dates}</Meta>}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

/** What the shown version is, and what can be done with it: publish a draft, or start one. */
function VersionBanner({
  version,
  draft,
  live,
  programCount,
  actions,
  onOpen,
}: {
  version: IVersionSummary;
  draft: IVersionSummary | undefined;
  live: IVersionSummary | undefined;
  programCount: number;
  actions: React.ReactNode;
  onOpen: (id: number) => void;
}) {
  const icon =
    version.status === "draft" ? IconPencil : version.status === "published" ? IconRocket : IconArchive;
  const Icon = icon;
  const programs = plural(programCount, "program");

  const text =
    version.status === "draft"
      ? {
          title: `v${version.versionNumber} is a draft`,
          line: live
            ? `Change the rules and documents here. The ${programs} keep using v${live.versionNumber} until you publish.`
            : "Add the rules and documents, then publish to make them live.",
        }
      : version.status === "published"
        ? {
            title: `v${version.versionNumber} is live`,
            line: `Published ${version.publishedAt ? formatDate(version.publishedAt) : ""} · checked for the ${programs} using this set. Live versions are locked.`,
          }
        : {
            title: `v${version.versionNumber} is archived`,
            line: "Replaced by a newer version. Past decisions made with it keep pointing here.",
          };

  return (
    <Card withBorder radius="lg" padding="md" className={classes.banner} data-status={version.status}>
      <Group justify="space-between" gap="md">
        <Group gap="sm" wrap="nowrap" align="flex-start" miw={0} style={{ flex: 1 }}>
          <ThemeIcon size={36} radius="md" variant="light" color={versionStatusColors[version.status]}>
            <Icon size={20} />
          </ThemeIcon>
          <div>
            <Text fw={700}>{text.title}</Text>
            <Text size="sm" c="dimmed">
              {text.line}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          {version.status !== "draft" && draft && (
            <Button
              variant="secondary"
              leftSection={<IconPencil size={16} />}
              onClick={() => onOpen(draft.id)}
            >
              Open Draft v{draft.versionNumber}
            </Button>
          )}
          {version.status === "archived" && live && (
            <Button variant="secondary" onClick={() => onOpen(live.id)}>
              View Live v{live.versionNumber}
            </Button>
          )}
          {actions}
        </Group>
      </Group>
    </Card>
  );
}

function PageSkeletonCards() {
  return (
    <Stack gap="lg">
      <Card withBorder radius="lg" padding="md">
        <Skeleton h={36} w="50%" />
      </Card>
      {[1, 2].map((key) => (
        <Card key={key} withBorder radius="lg" padding="lg">
          <CardSkeleton />
        </Card>
      ))}
    </Stack>
  );
}

/**
 * One eligibility set on its own page: a banner for the shown version (draft, live or archived),
 * then tabs for its rules (grouped by category), documents, programs and versions.
 */
export default function EligibilitySetDetail() {
  const setId = Number(useParams().id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TTab = TABS.find((value) => value === searchParams.get("tab")) ?? "rules";
  const versionParam = Number(searchParams.get("version")) || null;

  const set = useEligibilitySet(setId);
  const options = useEligibilityOptions().data;
  // The API takes the action from the HTTP method: POST create (also publish and duplicate),
  // PUT / PATCH update (also assign and reorder), DELETE delete (also discard).
  const can = useCan();
  const canCreate = can("eligibility", "create");
  const canUpdate = can("eligibility", "update");
  const canDelete = can("eligibility", "delete");

  const versions = useMemo(() => set.data?.versions ?? [], [set.data]);
  const draft = versions.find(({ status }) => status === "draft");
  const live = versions.find(({ status }) => status === "published");
  // The version in the URL, else the draft (that is where the work happens), else the live one.
  const current = versions.find(({ id }) => id === versionParam) ?? draft ?? live ?? versions[0] ?? null;
  const version = useEligibilityVersion(current?.id ?? null);

  const [setFormOpened, setForm] = useDisclosure();
  const [assignOpened, assignForm] = useDisclosure();
  const [duplicateOpened, duplicateForm] = useDisclosure();
  const [criterionOpened, criterionForm] = useDisclosure();
  const [documentOpened, documentForm] = useDisclosure();
  const [editingCriterion, setEditingCriterion] = useState<ICriterion | null>(null);
  const [editingDocument, setEditingDocument] = useState<IDocumentRequirement | null>(null);

  const deleteSet = useDeleteSet();
  const newVersion = useNewVersion();
  const publish = usePublishVersion();
  const discard = useDiscardDraft();
  const reorder = useReorderCriteria();
  const deleteCriterion = useDeleteCriterion();
  const saveDocument = useSaveDocument();
  const deleteDocument = useDeleteDocument();

  // A version in the URL that no longer exists (a discarded draft) falls back to the default.
  useEffect(() => {
    if (versionParam && versions.length && !versions.some(({ id }) => id === versionParam)) {
      setSearchParams((params) => {
        params.delete("version");
        return params;
      });
    }
  }, [versionParam, versions, setSearchParams]);

  // One call per change: two setSearchParams in a row each start from the same URL, so the second
  // would undo the first.
  const setParams = (changes: Record<string, string | null>) =>
    setSearchParams(
      (params) => {
        Object.entries(changes).forEach(([key, value]) =>
          value ? params.set(key, value) : params.delete(key)
        );
        return params;
      },
      { replace: true }
    );
  const setParam = (key: string, value: string | null) => setParams({ [key]: value });
  // Another version opens on its rules.
  const openVersion = (id: number) => setParams({ version: String(id), tab: null });

  const criteria = useMemo(() => version.data?.criteria ?? [], [version.data]);
  const documents = version.data?.documentRequirements ?? [];
  const isDraft = current?.status === "draft";
  const editRows = isDraft && (canUpdate || canDelete);

  // Rules grouped by category, in the order the categories first appear.
  const groups = useMemo(() => {
    const byCategory = new Map<string, { criterion: ICriterion; index: number }[]>();
    criteria.forEach((criterion, index) => {
      const list = byCategory.get(criterion.category) ?? [];
      list.push({ criterion, index });
      byCategory.set(criterion.category, list);
    });
    return [...byCategory.entries()];
  }, [criteria]);

  if (set.isLoading || set.error || !set.data) {
    return (
      <Page>
        <PageHeader
          title="Eligibility Set"
          parent={{ label: "Eligibility Criteria", to: RO_ELIGIBILITY_CRITERIA }}
        />
        {set.error ? (
          <RecordUnavailable
            error={set.error}
            noun="eligibility set"
            list={{ label: "Eligibility Criteria", to: RO_ELIGIBILITY_CRITERIA }}
          />
        ) : (
          <PageSkeletonCards />
        )}
      </Page>
    );
  }

  const onError = (title: string) => (error: unknown) => errorHandler(error, title);

  const confirmDeleteSet = () =>
    confirmDanger({
      title: "Delete eligibility set",
      message: (
        <>
          Delete <b>{set.data.name}</b> with all its versions? A set that programs use can't be deleted;
          unassign them first.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteSet.mutate(setId, {
          onSuccess: () => {
            notifications.show({ color: "green", title: "Eligibility set deleted", message: set.data.name });
            navigate(RO_ELIGIBILITY_CRITERIA);
          },
          onError: onError("Could not delete set"),
        }),
    });

  const confirmPublish = () =>
    current &&
    confirmDanger({
      title: `Publish v${current.versionNumber}`,
      message:
        "It becomes the live rules for every program using this set; the version live now is archived.",
      confirmLabel: "Publish",
      onConfirm: () =>
        publish.mutate(current.id, {
          onSuccess: () =>
            notifications.show({
              color: "green",
              title: `v${current.versionNumber} published`,
              message: set.data.name,
            }),
          onError: onError("Could not publish"),
        }),
    });

  const confirmDiscard = () =>
    current &&
    confirmDanger({
      title: `Discard v${current.versionNumber}`,
      message: "This draft and its criteria and documents are deleted.",
      confirmLabel: "Discard",
      onConfirm: () =>
        discard.mutate(current.id, {
          onSuccess: () => {
            setParam("version", null);
            notifications.show({
              color: "green",
              title: "Draft discarded",
              message: `${set.data.name} v${current.versionNumber}`,
            });
          },
          onError: onError("Could not discard the draft"),
        }),
    });

  const createVersion = () =>
    newVersion.mutate(setId, {
      onSuccess: (created) => {
        openVersion(created.id);
        notifications.show({
          color: "green",
          title: `v${created.versionNumber} draft created`,
          message: set.data.name,
        });
      },
      onError: onError("Could not create a version"),
    });

  // Arrows move a rule past the next one of its own category, so it stays in its group.
  const move = (index: number, step: -1 | 1) => {
    if (!current) return;
    const ids = criteria.map(({ id }) => id);
    let other = index + step;
    while (other >= 0 && other < criteria.length && criteria[other].category !== criteria[index].category) {
      other += step;
    }
    [ids[index], ids[other]] = [ids[other], ids[index]];
    reorder.mutate({ versionId: current.id, criterionIds: ids }, { onError: onError("Could not reorder") });
  };

  const openCriterion = (criterion: ICriterion | null) => {
    setEditingCriterion(criterion);
    criterionForm.open();
  };

  const openDocument = (document: IDocumentRequirement | null) => {
    setEditingDocument(document);
    documentForm.open();
  };

  const confirmDeleteCriterion = (criterion: ICriterion) =>
    confirmDanger({
      title: "Delete criterion",
      message: (
        <>
          Delete <b>{criterion.name}</b> from this draft?
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteCriterion.mutate(criterion.id, {
          onSuccess: () =>
            notifications.show({ color: "green", title: "Criterion deleted", message: criterion.name }),
          onError: onError("Could not delete criterion"),
        }),
    });

  const confirmDeleteDocument = (document: IDocumentRequirement) =>
    confirmDanger({
      title: "Delete document requirement",
      message: (
        <>
          Delete <b>{document.customLabel || document.documentType}</b> from this draft?
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () =>
        deleteDocument.mutate(document.id, {
          onSuccess: () =>
            notifications.show({
              color: "green",
              title: "Document requirement deleted",
              message: document.customLabel || document.documentType,
            }),
          onError: onError("Could not delete document"),
        }),
    });

  const toggleRequired = (document: IDocumentRequirement) =>
    current &&
    saveDocument.mutate(
      { id: document.id, versionId: current.id, isRequired: !document.isRequired },
      { onError: onError("Could not update document") }
    );

  // The banner's buttons for the shown version.
  const bannerActions = isDraft ? (
    <>
      {canCreate && (
        <Button variant="secondary" leftSection={<IconCopy size={16} />} onClick={duplicateForm.open}>
          Duplicate From
        </Button>
      )}
      {canDelete && (
        <Button
          variant="secondary"
          leftSection={<IconTrash size={16} />}
          onClick={confirmDiscard}
          loading={discard.isPending}
        >
          Discard
        </Button>
      )}
      {canCreate && (
        <Button leftSection={<IconRocket size={16} />} onClick={confirmPublish} loading={publish.isPending}>
          Publish v{current?.versionNumber}
        </Button>
      )}
    </>
  ) : (
    canCreate &&
    !draft && (
      <Button leftSection={<IconPlus size={16} />} onClick={createVersion} loading={newVersion.isPending}>
        New Version
      </Button>
    )
  );

  const required = documents.filter(({ isRequired }) => isRequired).length;

  return (
    <Page>
      <PageHeader
        title={set.data.name}
        description={set.data.description ?? undefined}
        parent={{ label: "Eligibility Criteria", to: RO_ELIGIBILITY_CRITERIA }}
        action={
          <Group gap="xs" wrap="nowrap">
            <Select
              aria-label="Version"
              data={versions.map((item) => ({ value: String(item.id), label: versionLabel(item) }))}
              value={current ? String(current.id) : null}
              onChange={(value) => value && openVersion(Number(value))}
              allowDeselect={false}
              leftSection={current && <StatusDot color={versionStatusColors[current.status]} />}
              w={170}
            />
            <RowActions
              name={set.data.name}
              onEdit={canUpdate ? setForm.open : undefined}
              onDelete={canDelete ? confirmDeleteSet : undefined}
            />
          </Group>
        }
      />

      {current && (
        <VersionBanner
          version={current}
          draft={draft}
          live={live}
          programCount={set.data.programs.length}
          actions={bannerActions}
          onOpen={openVersion}
        />
      )}

      <Tabs
        value={tab}
        onChange={(value) => setParam("tab", value === "rules" ? null : value)}
        keepMounted={false}
      >
        <Tabs.List mb="lg">
          <Tabs.Tab value="rules" leftSection={<IconListCheck size={16} />}>
            Rules{" "}
            <Text span c="dimmed" size="sm">
              {criteria.length}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
            Documents{" "}
            <Text span c="dimmed" size="sm">
              {documents.length}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="programs" leftSection={<IconSchool size={16} />}>
            Programs{" "}
            <Text span c="dimmed" size="sm">
              {set.data.programs.length}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="versions" leftSection={<IconArchive size={16} />}>
            Versions{" "}
            <Text span c="dimmed" size="sm">
              {versions.length}
            </Text>
          </Tabs.Tab>
        </Tabs.List>

        {/* Rules, grouped by category */}
        <Tabs.Panel value="rules">
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              {criteria.length
                ? `${plural(criteria.length, "rule")} · ${criteria.filter(({ isMandatory }) => isMandatory).length} mandatory. An application is checked against each one.`
                : "The rules an application is checked against."}
            </Text>
            {isDraft && canCreate && (
              <Button leftSection={<IconPlus size={16} />} onClick={() => openCriterion(null)}>
                New Criterion
              </Button>
            )}
          </Group>
          {version.isLoading ? (
            <Stack gap="sm">
              {[1, 2, 3].map((key) => (
                <Card key={key} withBorder radius="md" padding="md">
                  <CardSkeleton />
                </Card>
              ))}
            </Stack>
          ) : (
            <Card withBorder radius="lg" padding={criteria.length ? "lg" : 0} shadow="xs">
              <DataState
                isLoading={false}
                error={version.error}
                errorTitle="Could not load version"
                isEmpty={!criteria.length}
                emptyIcon={IconListCheck}
                emptyTitle="No rules yet"
                emptyText={isDraft && canCreate ? "Add the first rule with New Criterion." : undefined}
              >
                <Stack gap="xl">
                  {groups.map(([category, items]) => (
                    <Stack key={category} gap="sm">
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase" className={classes.category}>
                        {category} · {items.length}
                      </Text>
                      {items.map(({ criterion, index }, position) => (
                        <RuleCard
                          key={criterion.id}
                          criterion={criterion}
                          number={index + 1}
                          options={options}
                          onEdit={isDraft && canUpdate ? () => openCriterion(criterion) : undefined}
                          onDelete={
                            isDraft && canDelete ? () => confirmDeleteCriterion(criterion) : undefined
                          }
                          onMoveUp={
                            isDraft && canUpdate && position > 0 && !reorder.isPending
                              ? () => move(index, -1)
                              : undefined
                          }
                          onMoveDown={
                            isDraft && canUpdate && position < items.length - 1 && !reorder.isPending
                              ? () => move(index, 1)
                              : undefined
                          }
                        />
                      ))}
                    </Stack>
                  ))}
                </Stack>
              </DataState>
            </Card>
          )}
        </Tabs.Panel>

        {/* Documents the student must send */}
        <Tabs.Panel value="documents">
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              {documents.length
                ? `${plural(documents.length, "document")} · ${required} required. Students upload these with the application.`
                : "The documents a student uploads with the application."}
            </Text>
            {isDraft && canCreate && (
              <Button leftSection={<IconPlus size={16} />} onClick={() => openDocument(null)}>
                New Document Requirement
              </Button>
            )}
          </Group>
          {documents.length ? (
            <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
              {documents.map((document) => (
                <Card key={document.id} withBorder radius="md" padding="md">
                  <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
                    <Group gap="sm" wrap="nowrap" miw={0} align="flex-start">
                      <ThemeIcon
                        size={36}
                        radius="md"
                        variant="light"
                        color={document.isRequired ? "primary" : "gray"}
                      >
                        <IconFileText size={20} />
                      </ThemeIcon>
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} truncate>
                          {document.customLabel || document.documentType}
                        </Text>
                        {document.customLabel && (
                          <Text size="xs" c="dimmed">
                            {document.documentType}
                          </Text>
                        )}
                      </div>
                    </Group>
                    {editRows && (
                      <RowActions
                        name={document.customLabel || document.documentType}
                        onEdit={canUpdate ? () => openDocument(document) : undefined}
                        onDelete={canDelete ? () => confirmDeleteDocument(document) : undefined}
                      />
                    )}
                  </Group>
                  <Text size="sm" c="dimmed" mt="sm" lineClamp={3}>
                    {document.instructions || "No instructions"}
                  </Text>
                  <Group gap="xs" mt="md">
                    <Badge variant="light" color={document.isRequired ? "primary" : "gray"}>
                      {document.isRequired ? "Required" : "Optional"}
                    </Badge>
                    {isDraft && canUpdate && (
                      <Button variant="subtle" size="compact-xs" onClick={() => toggleRequired(document)}>
                        Make {document.isRequired ? "Optional" : "Required"}
                      </Button>
                    )}
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder radius="lg" padding={0} shadow="xs">
              <DataState
                isLoading={version.isLoading}
                error={null}
                errorTitle=""
                isEmpty
                emptyIcon={IconFileText}
                emptyTitle="No documents required yet"
                emptyText={isDraft && canCreate ? "Add one with New Document Requirement." : undefined}
              >
                {null}
              </DataState>
            </Card>
          )}
        </Tabs.Panel>

        {/* Programs that use this set */}
        <Tabs.Panel value="programs">
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              Applications to these programs are checked against the live version of this set.
            </Text>
            {canUpdate && (
              <Button variant="secondary" leftSection={<IconSchool size={16} />} onClick={assignForm.open}>
                Assign to Programs
              </Button>
            )}
          </Group>
          {set.data.programs.length ? (
            <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
              {set.data.programs.map((program) => (
                <Card key={program.id} withBorder radius="md" padding="md">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon size={36} radius="md" variant="light" color="violet">
                      <IconSchool size={20} />
                    </ThemeIcon>
                    <div style={{ minWidth: 0 }}>
                      <Text fw={600} truncate>
                        {program.name}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {program.code}
                      </Text>
                    </div>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder radius="lg" padding={0} shadow="xs">
              <DataState
                isLoading={false}
                error={null}
                errorTitle=""
                isEmpty
                emptyIcon={IconSchool}
                emptyTitle="Not used by any program yet"
                emptyText={
                  canUpdate ? "Assign it so their applications are checked against these rules." : undefined
                }
              >
                {null}
              </DataState>
            </Card>
          )}
        </Tabs.Panel>

        {/* Every version, newest first */}
        <Tabs.Panel value="versions">
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              Only a draft can change. Publishing makes it live and archives the one before.
            </Text>
            {canCreate && !draft && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={createVersion}
                loading={newVersion.isPending}
              >
                New Version
              </Button>
            )}
          </Group>
          <Card withBorder radius="lg" padding="lg" shadow="xs">
            <Timeline bulletSize={28} lineWidth={2}>
              {versions.map((item) => (
                <Timeline.Item
                  key={item.id}
                  color={versionStatusColors[item.status]}
                  bullet={
                    item.status === "draft" ? (
                      <IconPencil size={14} />
                    ) : item.status === "published" ? (
                      <IconRocket size={14} />
                    ) : (
                      <IconLock size={14} />
                    )
                  }
                  title={
                    <Group gap="xs">
                      <Text fw={600}>v{item.versionNumber}</Text>
                      <Badge variant="light" color={versionStatusColors[item.status]}>
                        {versionStatusLabels[item.status]}
                      </Badge>
                      {item.id === current?.id && (
                        <Badge variant="outline" color="primary">
                          Viewing
                        </Badge>
                      )}
                    </Group>
                  }
                >
                  <Group justify="space-between" gap="sm">
                    <Text size="sm" c="dimmed">
                      {plural(item.criteriaCount, "rule")}
                      {item.publishedAt ? ` · published ${formatDate(item.publishedAt)}` : ""}
                    </Text>
                    {item.id !== current?.id && (
                      <Button variant="subtle" size="compact-sm" onClick={() => openVersion(item.id)}>
                        View
                      </Button>
                    )}
                  </Group>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Tabs.Panel>
      </Tabs>

      {!canCreate && !canUpdate && !isDraft && (
        <Alert variant="light" color="gray" icon={<IconLock size={18} />}>
          Your role can view these rules but not change them.
        </Alert>
      )}

      <EligibilitySetForm opened={setFormOpened} set={set.data} onClose={setForm.close} />
      <AssignProgramsForm opened={assignOpened} set={set.data} onClose={assignForm.close} />
      {current && isDraft && (
        <>
          <DuplicateVersionForm
            opened={duplicateOpened}
            setId={setId}
            draft={current}
            onClose={duplicateForm.close}
          />
          <CriterionForm
            opened={criterionOpened}
            versionId={current.id}
            criterion={editingCriterion}
            options={options}
            onClose={criterionForm.close}
          />
          <DocumentRequirementForm
            opened={documentOpened}
            versionId={current.id}
            document={editingDocument}
            usedTypeIds={documents.map(({ documentTypeId }) => documentTypeId)}
            options={options}
            onClose={documentForm.close}
          />
        </>
      )}
    </Page>
  );
}
