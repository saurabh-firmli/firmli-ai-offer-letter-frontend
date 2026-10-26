import { Suspense, lazy } from "react";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { queryClient } from "./lib/queryClient";
import { cssVariablesResolver, theme } from "./theme";
import {
  RO_APPLICATION,
  RO_APPLICATIONS,
  RO_AI_USAGE,
  RO_AUDIT_LOG,
  RO_COMMUNICATIONS,
  RO_CAMPUSES,
  RO_DASHBOARD,
  RO_EDIT_APPLICATION,
  RO_ELIGIBILITY_CRITERIA,
  RO_ELIGIBILITY_SET,
  RO_EMAIL_TEMPLATES,
  RO_HOME,
  RO_LETTER_TEMPLATES,
  RO_LETTERS,
  RO_FORGOT_PASSWORD,
  RO_LOGIN,
  RO_RESET_PASSWORD,
  RO_MANUAL_REVIEW,
  RO_NEW_APPLICATION,
  RO_PROGRAMS,
  RO_PLATFORM,
  RO_PROFILE,
  RO_REPORTS,
  RO_ROLES,
  RO_SETTINGS,
  RO_USERS,
} from "./routes";
import AuthLayout from "./layout/AuthLayout";
import MainLayout from "./layout/MainLayout";
import { INavItem, navItems } from "./layout/navItems";
import { TAction, TModule } from "./lib/auth";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "./pages/NotFound";
import RequirePermission from "./components/RequirePermission";
import { PageSkeleton } from "./components/Skeletons";

// Pages are lazy loaded so each one becomes its own chunk.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Programs = lazy(() => import("./pages/Programs"));
const Campuses = lazy(() => import("./pages/Campuses"));
const Users = lazy(() => import("./pages/Users"));
const LetterTemplates = lazy(() => import("./pages/LetterTemplates"));
const EligibilityCriteria = lazy(() => import("./pages/EligibilityCriteria"));
const EligibilitySetDetail = lazy(() => import("./pages/EligibilitySetDetail"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Reports = lazy(() => import("./pages/Reports"));
const Profile = lazy(() => import("./pages/Profile"));
const Platform = lazy(() => import("./pages/Platform"));
const AiUsage = lazy(() => import("./pages/AiUsage"));
const Roles = lazy(() => import("./pages/Roles"));
const Settings = lazy(() => import("./pages/Settings"));
const Applications = lazy(() => import("./pages/Applications"));
const NewApplication = lazy(() => import("./pages/NewApplication"));
const ApplicationDetail = lazy(() => import("./pages/ApplicationDetail"));
const ManualReview = lazy(() => import("./pages/ManualReview"));
const Letters = lazy(() => import("./pages/Letters"));
const Communications = lazy(() => import("./pages/Communications"));

// Every page of a module needs read permission on it (components/RequirePermission.tsx).
// Modules not built yet: sidebar entries marked soon (layout/navItems.ts).
const comingSoonPages = navItems.filter(({ soon }) => soon);

// The applications pages, each behind its module's read permission; the wizard needs create to start
// an application. A draft (/applications/:id/edit) opens with create or update: the wizard lands
// there right after Create Draft, and its documents and submit are POSTs (create); saving the
// student / program again is a PUT (update).
const applicationPages: {
  path: string;
  page: React.ReactNode;
  module: TModule;
  action?: TAction | TAction[];
}[] = [
  { path: RO_APPLICATIONS, page: <Applications />, module: "applications" },
  { path: RO_NEW_APPLICATION, page: <NewApplication />, module: "applications", action: "create" },
  {
    path: RO_EDIT_APPLICATION,
    page: <NewApplication />,
    module: "applications",
    action: ["create", "update"],
  },
  { path: RO_APPLICATION, page: <ApplicationDetail />, module: "applications" },
  { path: RO_MANUAL_REVIEW, page: <ManualReview />, module: "reviews" },
  { path: RO_LETTERS, page: <Letters />, module: "letters" },
  { path: RO_COMMUNICATIONS, page: <Communications />, module: "communications" },
  { path: RO_REPORTS, page: <Reports />, module: "applications" },
];

// While a page's code loads (each page is its own chunk).
const PageLoader = PageSkeleton;

export const router = createBrowserRouter([
  {
    path: RO_HOME,
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to={RO_DASHBOARD} replace /> },
      // Any logged in user: their own account.
      {
        path: RO_PROFILE,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Profile />
          </Suspense>
        ),
      },
      // Firmli staff only (the page sends anyone else to the dashboard).
      {
        path: RO_PLATFORM,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Platform />
          </Suspense>
        ),
      },
      {
        path: RO_DASHBOARD,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: RO_PROGRAMS,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="programs">
              <Programs />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_CAMPUSES,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="campuses">
              <Campuses />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_USERS,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="users">
              <Users />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_LETTER_TEMPLATES,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="letter_templates">
              <LetterTemplates />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_EMAIL_TEMPLATES,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="email_templates">
              <EmailTemplates />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_ELIGIBILITY_CRITERIA,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="eligibility">
              <EligibilityCriteria />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_ELIGIBILITY_SET,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="eligibility">
              <EligibilitySetDetail />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_ROLES,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="roles">
              <Roles />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_SETTINGS,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="settings">
              <Settings />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_AI_USAGE,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="ai_usage">
              <AiUsage />
            </RequirePermission>
          </Suspense>
        ),
      },
      {
        path: RO_AUDIT_LOG,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module="audit_logs">
              <AuditLogs />
            </RequirePermission>
          </Suspense>
        ),
      },
      ...applicationPages.map(({ path, page, module, action }) => ({
        path,
        element: (
          <Suspense fallback={<PageLoader />}>
            <RequirePermission module={module} action={action}>
              {page}
            </RequirePermission>
          </Suspense>
        ),
      })),
      ...comingSoonPages.map(({ label, to, icon, module }: INavItem) => ({
        path: to,
        element: (
          <Suspense fallback={<PageLoader />}>
            {module ? (
              <RequirePermission module={module}>
                <ComingSoon title={label} icon={icon} />
              </RequirePermission>
            ) : (
              <ComingSoon title={label} icon={icon} />
            )}
          </Suspense>
        ),
      })),
    ],
  },
  // Outside MainLayout: no login needed here.
  {
    element: <AuthLayout />,
    children: [
      {
        path: RO_LOGIN,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Login />
          </Suspense>
        ),
      },
      {
        path: RO_FORGOT_PASSWORD,
        element: (
          <Suspense fallback={<PageLoader />}>
            <ForgotPassword />
          </Suspense>
        ),
      },
      {
        path: RO_RESET_PASSWORD,
        element: (
          <Suspense fallback={<PageLoader />}>
            <ResetPassword />
          </Suspense>
        ),
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
        <ModalsProvider>
          <Notifications position="top-right" />
          <RouterProvider router={router} />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
