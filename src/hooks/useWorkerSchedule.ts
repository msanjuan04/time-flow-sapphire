import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addWeeks, endOfWeek, format, startOfWeek } from "date-fns";

export interface WorkerScheduleDay {
  date: Date;
  expected_hours: number | null;
  start_time: string | null;
  end_time: string | null;
  notes?: string | null;
}

interface UseWorkerScheduleParams {
  userId?: string | null;
  companyId?: string | null;
}

const buildEmptyWeek = (baseStart: Date): WorkerScheduleDay[] =>
  Array.from({ length: 7 }).map((_, index) => {
    const date = addDays(baseStart, index);
    return {
      date,
      expected_hours: null,
      start_time: null,
      end_time: null,
      notes: null,
    };
  });

export const useWorkerSchedule = ({ userId, companyId }: UseWorkerScheduleParams) => {
  const initialWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const [weekStart, setWeekStart] = useState<Date>(initialWeekStart);
  const [scheduleDays, setScheduleDays] = useState<WorkerScheduleDay[]>(() => buildEmptyWeek(initialWeekStart));
  const [loading, setLoading] = useState(false);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const fetchWeekSchedule = useCallback(
    async (targetStart?: Date): Promise<WorkerScheduleDay[]> => {
      const baseStart = targetStart || weekStart;
      const fallbackWeek = buildEmptyWeek(baseStart);

      if (!userId || !companyId) {
        setScheduleDays(fallbackWeek);
        return fallbackWeek;
      }

      const targetEnd = endOfWeek(baseStart, { weekStartsOn: 1 });
      const startIso = format(baseStart, "yyyy-MM-dd");
      const endIso = format(targetEnd, "yyyy-MM-dd");

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("scheduled_hours")
          .select("date, expected_hours, start_time, end_time, notes")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .gte("date", startIso)
          .lte("date", endIso);

        if (error) {
          console.error("Error fetching worker schedule:", error);
          setScheduleDays(fallbackWeek);
          return fallbackWeek;
        }

        const scheduleMap = new Map<
          string,
          {
            expected_hours: number | null;
            start_time: string | null;
            end_time: string | null;
            notes?: string | null;
          }
        >();

        (data || []).forEach((row) => {
          scheduleMap.set(row.date, {
            expected_hours: row.expected_hours ?? null,
            start_time: row.start_time ?? null,
            end_time: row.end_time ?? null,
            notes: row.notes ?? null,
          });
        });

        const days: WorkerScheduleDay[] = Array.from({ length: 7 }).map((_, index) => {
          const date = addDays(baseStart, index);
          const iso = format(date, "yyyy-MM-dd");
          const match = scheduleMap.get(iso);
          return {
            date,
            expected_hours: match?.expected_hours ?? null,
            start_time: match?.start_time ?? null,
            end_time: match?.end_time ?? null,
            notes: match?.notes,
          };
        });

        setScheduleDays(days);
        return days;
      } finally {
        setLoading(false);
      }
    },
    [companyId, userId, weekStart]
  );

  useEffect(() => {
    fetchWeekSchedule();
  }, [fetchWeekSchedule]);

  useEffect(() => {
    if (!userId || !companyId) return;

    const channel = supabase
      .channel(`worker-schedule-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_hours",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchWeekSchedule()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchWeekSchedule, userId]);

  const goToPreviousWeek = useCallback(() => {
    setWeekStart((prev) => addWeeks(prev, -1));
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => addWeeks(prev, 1));
  }, []);

  const resetToCurrentWeek = useCallback(() => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, []);

  const refresh = useCallback(() => fetchWeekSchedule(), [fetchWeekSchedule]);

  return {
    weekStart,
    weekEnd,
    scheduleDays,
    loading,
    goToPreviousWeek,
    goToNextWeek,
    resetToCurrentWeek,
    refresh,
  };
};
