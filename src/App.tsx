import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SuperadminRoute } from "@/components/SuperadminRoute";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import ThemeToggle from "@/components/ThemeToggle";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Employees = lazy(() => import("./pages/Employees"));
const People = lazy(() => import("./pages/People"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Reports = lazy(() => import("./pages/Reports"));
const WorkerReports = lazy(() => import("./pages/WorkerReports"));
const Absences = lazy(() => import("./pages/Absences"));
const Calendar = lazy(() => import("./pages/Calendar"));
const ManagerCalendar = lazy(() => import("./pages/ManagerCalendar"));
const LocationReport = lazy(() => import("./pages/LocationReport"));
const CorrectionRequests = lazy(() => import("./pages/CorrectionRequests"));
const Devices = lazy(() => import("./pages/Devices"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
const AdminOverview = lazy(() => import("./pages/AdminOverview"));
const AdminCompanies = lazy(() => import("./pages/AdminCompanies"));
const AdminCompanyDetail = lazy(() => import("./pages/AdminCompanyDetail"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminLogs = lazy(() => import("./pages/AdminLogs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Logout = lazy(() => import("./pages/Logout"));
const Legal = lazy(() => import("./pages/Legal"));

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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/people" element={<People />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/worker-reports" element={<WorkerReports />} />
            <Route path="/absences" element={<Absences />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/manager-calendar" element={<ManagerCalendar />} />
            <Route path="/location-report" element={<LocationReport />} />
            <Route path="/correction-requests" element={<CorrectionRequests />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/kiosk" element={<Kiosk />} />
            <Route
              path="/admin"
              element={
                <SuperadminRoute>
                  <AdminOverview />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/companies"
              element={
                <SuperadminRoute>
                  <AdminCompanies />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/companies/:id"
              element={
                <SuperadminRoute>
                  <AdminCompanyDetail />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <SuperadminRoute>
                  <AdminUsers />
                </SuperadminRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <SuperadminRoute>
                  <AdminLogs />
                </SuperadminRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
