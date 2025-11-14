import WorkerView from "@/components/WorkerView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const WorkerClock = () => {
  useDocumentTitle("Mi jornada • GTiQ");
  return <WorkerView />;
};

export default WorkerClock;
