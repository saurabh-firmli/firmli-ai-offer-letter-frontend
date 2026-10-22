import {
  IconChartBar,
  IconClipboardCheck,
  IconFileCertificate,
  IconFileText,
  IconHistory,
  IconLayoutGrid,
  IconListCheck,
  IconMail,
  IconSchool,
  IconSend,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import {
  RO_APPLICATIONS,
  RO_AUDIT_LOG,
  RO_COMMUNICATIONS,
  RO_DASHBOARD,
  RO_ELIGIBILITY_CRITERIA,
  RO_EMAIL_TEMPLATES,
  RO_LETTER_TEMPLATES,
  RO_MANUAL_REVIEW,
  RO_PROGRAMS,
  RO_REPORTS,
  RO_SETTINGS,
  RO_USERS,
} from "../routes";

export interface INavItem {
  label: string;
  to: string;
  icon: typeof IconLayoutGrid;
}

export interface INavSection {
  title: string;
  items: INavItem[];
}

// Sidebar entries, grouped under section headings. Every entry except the dashboard
// renders the Coming Soon page until its module is built (see App.tsx).
export const navSections: INavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", to: RO_DASHBOARD, icon: IconLayoutGrid }],
  },
  {
    title: "Admissions",
    items: [
      { label: "Applications", to: RO_APPLICATIONS, icon: IconFileText },
      { label: "Manual Review", to: RO_MANUAL_REVIEW, icon: IconClipboardCheck },
      { label: "Programs", to: RO_PROGRAMS, icon: IconSchool },
      { label: "Eligibility Criteria", to: RO_ELIGIBILITY_CRITERIA, icon: IconListCheck },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Letter Templates", to: RO_LETTER_TEMPLATES, icon: IconFileCertificate },
      { label: "Email Templates", to: RO_EMAIL_TEMPLATES, icon: IconMail },
      { label: "Communications", to: RO_COMMUNICATIONS, icon: IconSend },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Reports", to: RO_REPORTS, icon: IconChartBar },
      { label: "Audit Log", to: RO_AUDIT_LOG, icon: IconHistory },
      { label: "Users", to: RO_USERS, icon: IconUsers },
      { label: "Settings", to: RO_SETTINGS, icon: IconSettings },
    ],
  },
];

export const navItems: INavItem[] = navSections.flatMap(({ items }) => items);
