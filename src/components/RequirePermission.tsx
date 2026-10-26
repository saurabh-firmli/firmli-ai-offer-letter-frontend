import { ReactNode } from "react";
import { Button } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import { Link } from "react-router";
import { LockedIllustration } from "./Illustrations";
import Page from "./Page";
import StatusScreen from "./StatusScreen";
import { TAction, TModule, useCan } from "../lib/auth";
import { RO_DASHBOARD } from "../routes";

/** Shown in place of a page the user's role can't read (the menu hides it; this covers the URL). */
export function NotAllowed() {
  return (
    <Page>
      <StatusScreen
        inline
        illustration={<LockedIllustration />}
        eyebrow="No access"
        title="You can't open this page"
        message="Your role doesn't allow it. Ask your institution's Super Admin if you need access."
        actions={
          <Button component={Link} to={RO_DASHBOARD} leftSection={<IconHome size={16} />}>
            Go to Dashboard
          </Button>
        }
      />
    </Page>
  );
}

/**
 * Wraps a route: the page shows only with read permission on its module, or another action for a
 * page that only does that (e.g. the New Application wizard needs create). A list of actions lets
 * in a user with any one of them.
 */
export default function RequirePermission({
  module,
  action = "read",
  children,
}: {
  module: TModule;
  action?: TAction | TAction[];
  children: ReactNode;
}) {
  const can = useCan();
  const actions = Array.isArray(action) ? action : [action];
  return actions.some((item) => can(module, item)) ? children : <NotAllowed />;
}
