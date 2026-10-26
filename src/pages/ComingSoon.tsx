import { Badge, Button, Card, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconRocket } from "@tabler/icons-react";
import { Link } from "react-router";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import { RO_DASHBOARD } from "../routes";
import classes from "./ComingSoon.module.css";

interface IComingSoonProps {
  title: string;
  icon?: typeof IconRocket;
}

// Placeholder page for modules that are not built yet.
export default function ComingSoon({ title, icon: Icon = IconRocket }: IComingSoonProps) {
  return (
    <Page>
      <PageHeader title={title} />

      <Card withBorder radius="lg" shadow="xs" className={classes.hero} py={80} px="xl">
        <Stack align="center" gap="lg" className={classes.content}>
          <div className={classes.iconTile}>
            <Icon size={40} stroke={1.6} />
          </div>

          <Stack align="center" gap={10} mt="sm">
            <Badge variant="light" color="orange" size="lg" radius="xl">
              In development
            </Badge>
            <Title order={2} fz={30}>
              Coming Soon
            </Title>
            <Text c="dimmed" ta="center" maw={460} fz="md">
              We're building the <b>{title}</b> module. It will show up here as soon as it ships — nothing to
              set up on your side.
            </Text>
          </Stack>

          <Button
            component={Link}
            to={RO_DASHBOARD}
            size="md"
            radius="md"
            leftSection={<IconArrowLeft size={18} />}
          >
            Back to Dashboard
          </Button>
        </Stack>
      </Card>
    </Page>
  );
}
