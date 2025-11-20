import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, Membership } from "@/contexts/AuthContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import ThemeToggle from "@/components/ThemeToggle";

// Lazy-loaded pages (renombradas a *Page para evitar choques de nombres)
const RoleRedirectPage = lazy(() => import("./pages/RoleRedirect"));
const AuthPage = lazy(() => import("./pages/Auth"));
const EmployeesPage = lazy(() => import("./pages/Employees"));
const PeoplePage = lazy(() => import("./pages/People"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvite"));
const ReportsPage = lazy(() => import("./pages/Reports"));
const WorkerReportsPage = lazy(() => import("./pages/WorkerReports"));
const AbsencesPage = lazy(() => import("./pages/Absences"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const ManagerCalendarPage = lazy(() => import("./pages/ManagerCalendar"));
const LocationReportPage = lazy(() => import("./pages/LocationReport"));
const CompanySettingsPage = lazy(() => import("./pages/CompanySettings"));
const CorrectionRequestsPage = lazy(() => import("./pages/CorrectionRequests"));
const DevicesPage = lazy(() => import("./pages/Devices"));
const KioskPage = lazy(() => import("./pages/Kiosk"));
const AdminOverviewPage = lazy(() => import("./pages/AdminOverview"));
const AdminCompaniesPage = lazy(() => import("./pages/AdminCompanies"));
const AdminCompanyDetailPage = lazy(() => import("./pages/AdminCompanyDetail"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsers"));
const AdminLogsPage = lazy(() => import("./pages/AdminLogs"));
const NotFoundPage = lazy(() => import("./pages/NotFound"));
const LogoutPage = lazy(() => import("./pages/Logout"));
const LegalPage = lazy(() => import("./pages/Legal"));
const AccessIssuePage = lazy(() => import("./pages/AccessIssue"));
const CompanyDashboardPage = lazy(() => import("./pages/CompanyDashboard"));
const WorkerClockPage = lazy(() => import("./pages/WorkerClock"));
const WorkerHistoryPage = lazy(() => import("./pages/WorkerHistory"));
const IncidentsPage = lazy(() => import("./pages/Incidents"));
const PrintViewPage = lazy(() => import("./pages/PrintView"));

const queryClient = new QueryClient();

type AllowedRole = "superadmin" | Membership["role"];

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: JSX.Element;
  allowedRoles?: AllowedRole[];
}) => {
  const { user, loading, memberships } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando sesión...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const primaryRole: AllowedRole | null = user.is_superadmin
      ? "superadmin"
      : memberships[0]?.role ?? null;

    if (!primaryRole || !allowedRoles.includes(primaryRole)) {
      return <Navigate to="/access-issue?reason=no-role" replace />;
    }
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <ThemeToggle />
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationBanner />
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>}>
          <Routes>
            <Route path="/" element={<RoleRedirectPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/access-issue" element={<AccessIssuePage />} />
            <Route path="/print/:id" element={<PrintViewPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["owner", "admin", "manager"]}>
                  <CompanyDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidents"
              element={
                <ProtectedRoute allowedRoles={["owner", "admin", "manager"]}>
                  <IncidentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/me/clock"
              element={
                <ProtectedRoute allowedRoles={["worker"]}>
                  <WorkerClockPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/me/history"
              element={
                <ProtectedRoute allowedRoles={["worker"]}>
                  <WorkerHistoryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/people"
              element={
                <ProtectedRoute>
                  <PeoplePage />
                </ProtectedRoute>
              }
            />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker-reports"
              element={
                <ProtectedRoute>
                  <WorkerReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/absences"
              element={
                <ProtectedRoute>
                  <AbsencesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager-calendar"
              element={
                <ProtectedRoute>
                  <ManagerCalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/location-report"
              element={
                <ProtectedRoute>
                  <LocationReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/correction-requests"
              element={
                <ProtectedRoute>
                  <CorrectionRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <DevicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company-settings"
              element={
                <ProtectedRoute allowedRoles={["owner", "admin", "manager"]}>
                  <CompanySettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/kiosk" element={<KioskPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["superadmin"]}>
                  <AdminOverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/companies"
              element={
                <ProtectedRoute allowedRoles={["superadmin"]}>
                  <AdminCompaniesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/companies/:id"
              element={
                <ProtectedRoute allowedRoles={["superadmin"]}>
                  <AdminCompanyDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["superadmin"]}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute allowedRoles={["superadmin"]}>
                  <AdminLogsPage />
                </ProtectedRoute>
              }
            />

            {/* catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
      </BrowserRouter>
  </QueryClientProvider>
);

export default App;
