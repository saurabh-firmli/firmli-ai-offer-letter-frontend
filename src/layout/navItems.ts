import {
  IconChartBar,
  IconCpu,
  IconClipboardCheck,
  IconFileCertificate,
  IconFileDescription,
  IconFileText,
  IconHistory,
  IconLayoutGrid,
  IconListCheck,
  IconMail,
  IconBuilding,
  IconSchool,
  IconSend,
  IconSettings,
  IconShieldLock,
  IconUsers,
} from "@tabler/icons-react";
import { TModule } from "../lib/auth";
import {
  RO_AI_USAGE,
  RO_APPLICATIONS,
  RO_AUDIT_LOG,
  RO_COMMUNICATIONS,
  RO_DASHBOARD,
  RO_ELIGIBILITY_CRITERIA,
  RO_EMAIL_TEMPLATES,
  RO_LETTER_TEMPLATES,
  RO_LETTERS,
  RO_MANUAL_REVIEW,
  RO_PROGRAMS,
  RO_CAMPUSES,
  RO_REPORTS,
  RO_ROLES,
  RO_SETTINGS,
  RO_USERS,
} from "../routes";

export interface INavItem {
  label: string;
  to: string;
  icon: typeof IconLayoutGrid;
  module?: TModule; // shown only with read permission on it (layout/MainLayout.tsx)
  soon?: boolean; // not built yet: a "Soon" tag in the sidebar and the Coming Soon page
}

export interface INavSection {
  title: string;
  items: INavItem[];
}

// Sidebar entries, grouped under section headings. Entries marked soon: true render the Coming
// Soon page (App.tsx); remove the flag once the module has its own page and route.
export const navSections: INavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", to: RO_DASHBOARD, icon: IconLayoutGrid }],
  },
  {
    title: "Admissions",
    items: [
      { label: "Applications", to: RO_APPLICATIONS, icon: IconFileText, module: "applications" },
      { label: "Manual Review", to: RO_MANUAL_REVIEW, icon: IconClipboardCheck, module: "reviews" },
      { label: "Programs", to: RO_PROGRAMS, icon: IconSchool, module: "programs" },
      { label: "Campuses", to: RO_CAMPUSES, icon: IconBuilding, module: "campuses" },
      {
        label: "Eligibility Criteria",
        to: RO_ELIGIBILITY_CRITERIA,
        icon: IconListCheck,
        module: "eligibility",
      },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Letters", to: RO_LETTERS, icon: IconFileDescription, module: "letters" },
      {
        label: "Letter Templates",
        to: RO_LETTER_TEMPLATES,
        icon: IconFileCertificate,
        module: "letter_templates",
      },
      { label: "Email Templates", to: RO_EMAIL_TEMPLATES, icon: IconMail, module: "email_templates" },
      { label: "Communications", to: RO_COMMUNICATIONS, icon: IconSend, module: "communications" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Reports", to: RO_REPORTS, icon: IconChartBar, module: "applications" },
      { label: "AI Usage", to: RO_AI_USAGE, icon: IconCpu, module: "ai_usage" },
      { label: "Audit Log", to: RO_AUDIT_LOG, icon: IconHistory, module: "audit_logs" },
      { label: "Users", to: RO_USERS, icon: IconUsers, module: "users" },
      { label: "Roles & Permissions", to: RO_ROLES, icon: IconShieldLock, module: "roles" },
      { label: "Settings", to: RO_SETTINGS, icon: IconSettings, module: "settings" },
    ],
  },
];

export const navItems: INavItem[] = navSections.flatMap(({ items }) => items);
