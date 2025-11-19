import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type VacationScope = "company" | "individual";

interface VacationAssignmentProps {
  companyId: string;
  ownerId?: string | null;
}

interface WorkerOption {
  id: string;
  label: string;
  role: "admin" | "manager" | "worker";
}

const fetchableRoles: WorkerOption["role"][] = ["admin", "manager", "worker"];

const VacationAssignment = ({ companyId, ownerId }: VacationAssignmentProps) => {
  const [scope, setScope] = useState<VacationScope>("individual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedWorker, setSelectedWorker] = useState("");
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingWorkers, setFetchingWorkers] = useState(false);

  const fetchWorkers = useCallback(async () => {
    if (!companyId) return;
    setFetchingWorkers(true);
    try {
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id, role, profile:profiles(id, full_name, email)")
        .eq("company_id", companyId)
        .in("role", fetchableRoles);

      if (error) throw error;

      const normalized: WorkerOption[] = ((data as any[]) || [])
        .map((row) => ({
          id: row.user_id,
          label:
            row.profile?.full_name?.trim() ||
            row.profile?.email?.trim() ||
            "Sin nombre",
          role: row.role as WorkerOption["role"],
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setWorkers(normalized);
    } catch (error) {
      console.error("Error fetching workers for vacations", error);
      toast.error("No pudimos cargar los trabajadores disponibles");
    } finally {
      setFetchingWorkers(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    if (scope === "company") {
      setSelectedWorker("");
    }
  }, [scope]);

  useEffect(() => {
    if (selectedWorker && !workers.some((worker) => worker.id === selectedWorker)) {
      setSelectedWorker("");
    }
  }, [selectedWorker, workers]);

  const hasFullRange = Boolean(startDate && endDate);
  const rangeIsValid = hasFullRange ? new Date(startDate) <= new Date(endDate) : true;
  const targetWorkers = useMemo(() => {
    if (scope === "company") {
      return workers;
    }
    return workers.filter((worker) => worker.id === selectedWorker);
  }, [scope, selectedWorker, workers]);

  const isButtonDisabled =
    loading ||
    fetchingWorkers ||
    !hasFullRange ||
    !rangeIsValid ||
    (scope === "individual" && !selectedWorker) ||
    (scope === "company" && workers.length === 0);

  const handleAssignVacations = async () => {
    if (!ownerId) {
      toast.error("No pudimos identificar al responsable de esta acción");
      return;
    }
    if (!hasFullRange || !rangeIsValid) {
      toast.error("Por favor selecciona un rango válido");
      return;
    }
    if (scope === "company" && workers.length === 0) {
      toast.error("No hay trabajadores registrados para aplicar vacaciones");
      return;
    }
    if (scope === "individual" && targetWorkers.length === 0) {
      toast.error("Selecciona un trabajador para asignar vacaciones");
      return;
    }

    setLoading(true);
    try {
      const actorId = ownerId;
      const reason =
        scope === "company"
          ? "Vacaciones de empresa"
          : `Vacaciones de ${targetWorkers[0]?.label ?? "trabajador"}`;

      const records = targetWorkers.map((worker) => ({
        user_id: worker.id,
        company_id: companyId,
        absence_type: "vacation" as const,
        start_date: startDate,
        end_date: endDate,
        reason,
        status: "approved",
        created_by: actorId,
        approved_by: actorId,
        approved_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("absences").insert(records);
      if (error) throw error;

      toast.success(
        scope === "company"
          ? "Vacaciones de empresa asignadas correctamente"
          : "Vacaciones individuales registradas"
      );

      setStartDate("");
      setEndDate("");
      setSelectedWorker("");
    } catch (error) {
      console.error("Error assigning vacations", error);
      const message = error instanceof Error ? error.message : "No pudimos asignar las vacaciones";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const scopeDescription =
    scope === "company"
      ? "Se marcará a todo el equipo de trabajo durante el rango seleccionado."
      : "Solo se aplicará al trabajador elegido.";

  const rangeError = hasFullRange && !rangeIsValid;

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Vacaciones</p>
        <h2 className="text-xl font-semibold">Planificador de vacaciones</h2>
        <p className="text-sm text-muted-foreground">{scopeDescription}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Ámbito</Label>
          <ToggleGroup
            type="single"
            value={scope}
            onValueChange={(value) => value && setScope(value as VacationScope)}
            className="rounded-2xl border border-input bg-muted/40 p-1"
            aria-label="Alcance de las vacaciones"
          >
            <ToggleGroupItem
              value="individual"
              className="flex-1 rounded-xl text-center text-sm font-semibold"
            >
              Individual
            </ToggleGroupItem>
            <ToggleGroupItem
              value="company"
              className="flex-1 rounded-xl text-center text-sm font-semibold"
            >
              Toda la empresa
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vacation-start">Desde</Label>
            <Input
              id="vacation-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vacation-end">Hasta</Label>
            <Input
              id="vacation-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>

        {scope === "individual" && (
          <div className="space-y-2">
            <Label>Trabajador</Label>
            <Select
              value={selectedWorker}
              onValueChange={setSelectedWorker}
              disabled={fetchingWorkers}
            >
              <SelectTrigger>
                <SelectValue placeholder={fetchingWorkers ? "Cargando..." : "Selecciona un trabajador"} />
              </SelectTrigger>
              <SelectContent>
                {workers.length === 0 && (
                  <SelectItem value="no-workers" disabled>
                    No hay trabajadores disponibles
                  </SelectItem>
                )}
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{worker.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {worker.role}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aún no hay trabajadores registrados en la empresa.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Button
          type="button"
          className="w-full"
          onClick={handleAssignVacations}
          disabled={isButtonDisabled}
        >
          {loading ? "Asignando..." : "Asignar vacaciones"}
        </Button>
        {rangeError && (
          <p className="text-xs text-destructive-foreground">
            La fecha de inicio debe ser anterior o igual a la fecha de fin.
          </p>
        )}
        {scope === "company" && workers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Se marcarán {workers.length} trabajadores durante el rango seleccionado.
          </p>
        )}
      </div>
    </Card>
  );
};

export default VacationAssignment;
