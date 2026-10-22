import { Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconClock,
  IconFileAlert,
  IconFileText,
  IconHourglass,
  IconMail,
  IconMailX,
  IconPercentage,
  IconPlus,
  IconTrendingUp,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { RO_NEW_APPLICATION } from "../routes";
import classes from "./Dashboard.module.css";

type TIcon = typeof IconFileText;

interface IStat {
  label: string;
  value: string;
  icon: TIcon;
  color: string;
}

// Sample numbers until the dashboard API exists.
const institutionName = "Firmli University";

const stats: IStat[] = [
  { label: "Total Applications", value: "14", icon: IconFileText, color: "blue" },
  { label: "Received Today", value: "0", icon: IconClock, color: "blue" },
  { label: "Pending Assessments", value: "3", icon: IconClipboardList, color: "orange" },
  { label: "Conditional Offers", value: "2", icon: IconCircleCheck, color: "green" },
  { label: "Rejections", value: "2", icon: IconCircleX, color: "red" },
  { label: "Manual Review", value: "7", icon: IconAlertCircle, color: "orange" },
  { label: "Missing Documents", value: "1", icon: IconFileAlert, color: "orange" },
  { label: "Letters Waiting", value: "0", icon: IconFileText, color: "blue" },
  { label: "Emails Sent", value: "0", icon: IconMail, color: "green" },
  { label: "Failed Emails", value: "0", icon: IconMailX, color: "red" },
  { label: "Avg Processing Time", value: "1m 21s", icon: IconHourglass, color: "blue" },
  { label: "Offer Rate", value: "18%", icon: IconTrendingUp, color: "green" },
];

const rates: IStat[] = [
  { label: "Offer Rate", value: "18%", icon: IconPercentage, color: "green" },
  { label: "Rejection Rate", value: "18%", icon: IconPercentage, color: "red" },
  { label: "Manual Review Rate", value: "64%", icon: IconPercentage, color: "orange" },
];

function StatCard({ label, value, icon: Icon, color }: IStat) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" className={classes.card}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={6}>
          <Text c="dimmed" fw={500}>
            {label}
          </Text>
          <Text fz={32} fw={700} lh={1.1}>
            {value}
          </Text>
        </Stack>
        <ThemeIcon size={56} radius="md" variant="light" color="gray" c={`${color}.6`}>
          <Icon size={26} stroke={1.6} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function RateCard({ label, value, icon: Icon, color }: IStat) {
  return (
    <Card withBorder radius="lg" padding="lg" shadow="xs" className={classes.card}>
      <Group gap="lg" wrap="nowrap">
        <ThemeIcon size={64} radius="md" variant="light" color={color}>
          <Icon size={30} stroke={1.8} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text c="dimmed" fz="lg">
            {label}
          </Text>
          <Text fz={30} fw={700} lh={1.1}>
            {value}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
}

export default function Dashboard() {
  return (
    <Stack p={{ base: "md", sm: 40 }} gap="xl">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={1} fz={34}>
            Dashboard
          </Title>
          <Text c="dimmed" fz="lg">
            Admissions overview for {institutionName}
          </Text>
        </Stack>
        <Button
          component={Link}
          to={RO_NEW_APPLICATION}
          color="dark"
          size="lg"
          leftSection={<IconPlus size={18} />}
        >
          New Application
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="lg">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {rates.map((rate) => (
          <RateCard key={rate.label} {...rate} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
