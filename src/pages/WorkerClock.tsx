import WorkerView from "@/components/WorkerView";
import { AppLayout } from "@/components/AppLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const WorkerClock = () => {
  useDocumentTitle("Mi jornada • GTiQ");
  return <AppLayout><WorkerView /></AppLayout>;
};

export default WorkerClock;
