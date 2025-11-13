import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
}

interface RecentActivityProps {
  logs: ActivityLog[];
  loading: boolean;
}

export const RecentActivity = ({ logs, loading }: RecentActivityProps) => {
  return (
    <Card className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Actividad reciente</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Cargando actividad...
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Sin actividad reciente.
        </p>
      ) : (
        <div className="space-y-3">
          {logs.slice(0, 6).map((log) => (
            <div
              key={log.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{log.action}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(log.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
              {log.entity_type && (
                <Badge variant="outline" className="shrink-0">
                  {log.entity_type}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
