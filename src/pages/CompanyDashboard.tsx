import AdminView from "@/components/AdminView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const CompanyDashboard = () => {
  useDocumentTitle("Panel de empresa • GTiQ");
  return <AdminView />;
};

export default CompanyDashboard;
