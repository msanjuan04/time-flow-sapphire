import AdminView from "@/components/AdminView";
import { AppLayout } from "@/components/AppLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const CompanyDashboard = () => {
  useDocumentTitle("Panel de empresa • GTiQ");
  return <AppLayout><AdminView /></AppLayout>;
};

export default CompanyDashboard;
