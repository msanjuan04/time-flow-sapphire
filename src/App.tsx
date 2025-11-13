import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SuperadminRoute } from "@/components/SuperadminRoute";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import ThemeToggle from "@/components/ThemeToggle";

// Lazy-loaded pages (renombradas a *Page para evitar choques de nombres)
const IndexPage = lazy(() => import("./pages/Index"));
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

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

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
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <IndexPage />
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/legal" element={<LegalPage />} />

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
            <Route path="/kiosk" element={<KioskPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <SuperadminRoute>
                    <AdminOverviewPage />
                  </SuperadminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/companies"
              element={
                <ProtectedRoute>
                  <SuperadminRoute>
                    <AdminCompaniesPage />
                  </SuperadminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/companies/:id"
              element={
                <ProtectedRoute>
                  <SuperadminRoute>
                    <AdminCompanyDetailPage />
                  </SuperadminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <SuperadminRoute>
                    <AdminUsersPage />
                  </SuperadminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute>
                  <SuperadminRoute>
                    <AdminLogsPage />
                  </SuperadminRoute>
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
