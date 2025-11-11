import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SuperadminRoute } from "@/components/SuperadminRoute";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Employees from "./pages/Employees";
import People from "./pages/People";
import AcceptInvite from "./pages/AcceptInvite";
import Reports from "./pages/Reports";
import CorrectionRequests from "./pages/CorrectionRequests";
import Devices from "./pages/Devices";
import Kiosk from "./pages/Kiosk";
import Admin from "./pages/Admin";
import AdminCompanies from "./pages/AdminCompanies";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationBanner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/people" element={<People />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/correction-requests" element={<CorrectionRequests />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route 
            path="/admin" 
            element={
              <SuperadminRoute>
                <Admin />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
