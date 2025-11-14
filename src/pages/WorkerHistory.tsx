import WorkerReportsPage from "./WorkerReports";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const WorkerHistory = () => {
  useDocumentTitle("Mi historial • GTiQ");
  return <WorkerReportsPage />;
};

export default WorkerHistory;
