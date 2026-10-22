import { Suspense, lazy } from "react";
import { Center, Loader, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { IconFilePlus } from "@tabler/icons-react";
import { queryClient } from "./lib/queryClient";
import { theme } from "./theme";
import { RO_DASHBOARD, RO_HOME, RO_NEW_APPLICATION, RO_SIGNED_OUT } from "./routes";
import MainLayout from "./layout/MainLayout";
import { navItems } from "./layout/navItems";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "./pages/NotFound";

// Pages are lazy loaded so each one becomes its own chunk.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const SignedOut = lazy(() => import("./pages/SignedOut"));

// Modules not built yet: every sidebar entry except the dashboard, plus New Application.
const comingSoonPages = [
  ...navItems.filter(({ to }) => to !== RO_DASHBOARD),
  { label: "New Application", to: RO_NEW_APPLICATION, icon: IconFilePlus },
];

const PageLoader = () => (
  <Center h="60vh">
    <Loader />
  </Center>
);

export const router = createBrowserRouter([
  {
    path: RO_HOME,
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to={RO_DASHBOARD} replace /> },
      {
        path: RO_DASHBOARD,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        ),
      },
      ...comingSoonPages.map(({ label, to, icon }) => ({
        path: to,
        element: (
          <Suspense fallback={<PageLoader />}>
            <ComingSoon title={label} icon={icon} />
          </Suspense>
        ),
      })),
    ],
  },
  // Outside MainLayout so no API query runs here.
  {
    path: RO_SIGNED_OUT,
    element: (
      <Suspense fallback={<PageLoader />}>
        <SignedOut />
      </Suspense>
    ),
  },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <ModalsProvider>
          <Notifications position="top-right" />
          <RouterProvider router={router} />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
