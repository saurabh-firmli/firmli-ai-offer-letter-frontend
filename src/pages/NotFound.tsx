import { Button } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import { Link } from "react-router";
import { NotFoundIllustration } from "../components/Illustrations";
import StatusScreen from "../components/StatusScreen";
import { RO_DASHBOARD } from "../routes";

export default function NotFound() {
  return (
    <StatusScreen
      illustration={<NotFoundIllustration />}
      eyebrow="Error 404"
      title="We can't find that page"
      message="The link may be wrong, or the page was moved. Check the address or go back to the dashboard."
      actions={
        <Button component={Link} to={RO_DASHBOARD} leftSection={<IconHome size={16} />}>
          Go to Dashboard
        </Button>
      }
    />
  );
}
