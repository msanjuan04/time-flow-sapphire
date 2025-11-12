import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
            <Route path="/" element={<IndexPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/legal" element={<LegalPage />} />

            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/worker-reports" element={<WorkerReportsPage />} />
            <Route path="/absences" element={<AbsencesPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/manager-calendar" element={<ManagerCalendarPage />} />
            <Route path="/location-report" element={<LocationReportPage />} />
            <Route path="/correction-requests" element={<CorrectionRequestsPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/kiosk" element={<KioskPage />} />

            <Route
              path="/admin"
              element={
                <SuperadminRoute>
                  <AdminOverviewPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/companies"
              element={
                <SuperadminRoute>
                  <AdminCompaniesPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/companies/:id"
              element={
                <SuperadminRoute>
                  <AdminCompanyDetailPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <SuperadminRoute>
                  <AdminUsersPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <SuperadminRoute>
                  <AdminLogsPage />
                </SuperadminRoute>
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