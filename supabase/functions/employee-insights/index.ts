import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmployeeInsight {
  employee_id: string;
  employee_name: string;
  strengths: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  performance_trend: 'improving' | 'stable' | 'declining';
  recognition_suggestions?: string[];
  trend_percentage?: number;
}

const calculateHours = (sessions: any[]): number => {
  return sessions.reduce((total, session) => {
    if (!session.clock_in_time) return total;
    const clockIn = new Date(session.clock_in_time).getTime();
    const clockOut = session.clock_out_time ? new Date(session.clock_out_time).getTime() : Date.now();
    const pauseDuration = Number(session.total_pause_duration ?? 0);
    const duration = Math.max(0, clockOut - clockIn - pauseDuration);
    return total + duration / (1000 * 60 * 60);
  }, 0);
};

const parseTime = (timeStr: string | null): { hours: number; minutes: number } | null => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return { hours, minutes };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { employee_id, company_id } = await req.json().catch(() => ({}));

    if (!employee_id || !company_id) {
      return new Response(
        JSON.stringify({ error: 'employee_id and company_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);

    // Get employee profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', employee_id)
      .single();

    const employeeName = profile?.full_name || profile?.email || 'Empleado';

    // Get scheduled hours assigned by owner
    const { data: scheduledHours } = await supabaseAdmin
      .from('scheduled_hours')
      .select('date, expected_hours, start_time, end_time')
      .eq('company_id', company_id)
      .eq('user_id', employee_id)
      .gte('date', threeMonthsAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get approved absences
    const { data: absences } = await supabaseAdmin
      .from('absences')
      .select('start_date, end_date, absence_type, status')
      .eq('company_id', company_id)
      .eq('user_id', employee_id)
      .eq('status', 'approved')
      .gte('end_date', threeMonthsAgo.toISOString().split('T')[0]);

    // Get time events for analysis
    const { data: events } = await supabaseAdmin
      .from('time_events')
      .select('id, event_type, event_time')
      .eq('company_id', company_id)
      .eq('user_id', employee_id)
      .gte('event_time', threeMonthsAgo.toISOString())
      .order('event_time', { ascending: false });

    // Get work sessions
    const { data: sessions } = await supabaseAdmin
      .from('work_sessions')
      .select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration')
      .eq('company_id', company_id)
      .eq('user_id', employee_id)
      .gte('clock_in_time', threeMonthsAgo.toISOString());

    // Get incidents
    const { data: incidents } = await supabaseAdmin
      .from('incidents')
      .select('id, type, created_at, status')
      .eq('company_id', company_id)
      .eq('user_id', employee_id)
      .gte('created_at', threeMonthsAgo.toISOString());

    if (!events || events.length < 5) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient data',
          message: 'Se necesitan al menos 5 fichajes para generar insights'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const strengths: string[] = [];
    const areas_for_improvement: string[] = [];
    const recommendations: string[] = [];
    const recognition_suggestions: string[] = [];

    // Create a map of scheduled hours by date
    const scheduledMap = new Map<string, { expected_hours: number; start_time: string | null; end_time: string | null }>();
    (scheduledHours || []).forEach((sh: any) => {
      scheduledMap.set(sh.date, {
        expected_hours: Number(sh.expected_hours || 0),
        start_time: sh.start_time,
        end_time: sh.end_time
      });
    });

    // Create a map of absences by date
    const absenceMap = new Set<string>();
    (absences || []).forEach((abs: any) => {
      const start = new Date(abs.start_date);
      const end = new Date(abs.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        absenceMap.add(d.toISOString().split('T')[0]);
      }
    });

    // Analyze punctuality based on scheduled start_time
    const clockInEvents = (events || []).filter((e: any) => e.event_type === 'clock_in');
    const recentClockIns = clockInEvents.filter((e: any) => {
      const eventDate = new Date(e.event_time);
      return eventDate >= monthStart && !absenceMap.has(eventDate.toISOString().split('T')[0]);
    });

    if (recentClockIns.length > 0) {
      let onTimeCount = 0;
      let totalWithSchedule = 0;
      const lateDetails: { date: string; minutes: number }[] = [];

      recentClockIns.forEach((event: any) => {
        const eventDate = new Date(event.event_time);
        const dateStr = eventDate.toISOString().split('T')[0];
        const scheduled = scheduledMap.get(dateStr);

        if (scheduled && scheduled.start_time) {
          totalWithSchedule++;
          const scheduledTime = parseTime(scheduled.start_time);
          if (scheduledTime) {
            const expectedTime = new Date(eventDate);
            expectedTime.setHours(scheduledTime.hours, scheduledTime.minutes, 0, 0);
            const tolerance = 5 * 60 * 1000; // 5 minutes tolerance
            const eventTime = new Date(event.event_time);
            const minutesLate = Math.round((eventTime.getTime() - expectedTime.getTime()) / (1000 * 60));

            if (eventTime <= expectedTime.getTime() + tolerance) {
              onTimeCount++;
            } else if (minutesLate > 0) {
              lateDetails.push({ date: dateStr, minutes: minutesLate });
            }
          }
        }
      });

      if (totalWithSchedule > 0) {
        const punctualityRate = (onTimeCount / totalWithSchedule) * 100;
        const avgLateMinutes = lateDetails.length > 0
          ? lateDetails.reduce((sum, d) => sum + d.minutes, 0) / lateDetails.length
          : 0;

        if (punctualityRate >= 95) {
          strengths.push(`${punctualityRate.toFixed(0)}% de puntualidad según horario asignado (${onTimeCount}/${totalWithSchedule} días)`);
          recognition_suggestions.push('Reconocimiento por excelente puntualidad');
        } else if (punctualityRate < 80) {
          areas_for_improvement.push(
            `Puntualidad: ${punctualityRate.toFixed(0)}% según horario asignado (${onTimeCount}/${totalWithSchedule} días)${avgLateMinutes > 0 ? `, promedio de retraso: ${avgLateMinutes.toFixed(0)}min` : ''}`
          );
          recommendations.push('Revisar cumplimiento del horario de entrada asignado y comunicar la importancia de la puntualidad');
        }
      }
    }

    // Analyze hours worked vs expected hours
    if (sessions && scheduledHours && scheduledHours.length > 0) {
      const thisMonthSessions = (sessions as any[]).filter((s: any) => {
        const sessionDate = new Date(s.clock_in_time);
        return sessionDate >= monthStart && !absenceMap.has(sessionDate.toISOString().split('T')[0]);
      });

      if (thisMonthSessions.length > 0) {
        let totalExpected = 0;
        let totalActual = 0;
        let daysWithSchedule = 0;
        const complianceDetails: { date: string; expected: number; actual: number }[] = [];

        thisMonthSessions.forEach((session: any) => {
          const sessionDate = new Date(session.clock_in_time);
          const dateStr = sessionDate.toISOString().split('T')[0];
          const scheduled = scheduledMap.get(dateStr);

          if (scheduled && scheduled.expected_hours > 0) {
            daysWithSchedule++;
            const expected = scheduled.expected_hours;
            const actual = calculateHours([session]);
            totalExpected += expected;
            totalActual += actual;
            complianceDetails.push({ date: dateStr, expected, actual });
          }
        });

        if (daysWithSchedule > 0) {
          const complianceRate = (totalActual / totalExpected) * 100;
          const avgDifference = totalActual - totalExpected;

          if (complianceRate >= 95 && complianceRate <= 105) {
            strengths.push(`Cumplimiento de horas: ${complianceRate.toFixed(0)}% (${totalActual.toFixed(1)}h trabajadas vs ${totalExpected.toFixed(1)}h esperadas)`);
          } else if (complianceRate < 90) {
            areas_for_improvement.push(
              `Cumplimiento de horas: ${complianceRate.toFixed(0)}% (${totalActual.toFixed(1)}h trabajadas vs ${totalExpected.toFixed(1)}h esperadas, faltan ${Math.abs(avgDifference).toFixed(1)}h)`
            );
            recommendations.push('Revisar por qué no se están cumpliendo las horas esperadas asignadas');
          } else if (complianceRate > 110) {
            areas_for_improvement.push(
              `Exceso de horas trabajadas: ${complianceRate.toFixed(0)}% (${totalActual.toFixed(1)}h trabajadas vs ${totalExpected.toFixed(1)}h esperadas, ${avgDifference.toFixed(1)}h de más)`
            );
            recommendations.push('Verificar si el exceso de horas es necesario o si se debe ajustar el horario asignado');
          }
        }
      }
    }

    // Analyze adherence to scheduled start/end times
    if (scheduledHours && scheduledHours.length > 0) {
      const sessionsWithSchedule = (sessions || []).filter((s: any) => {
        if (!s.clock_in_time || !s.clock_out_time) return false;
        const sessionDate = new Date(s.clock_in_time);
        const dateStr = sessionDate.toISOString().split('T')[0];
        return scheduledMap.has(dateStr) && !absenceMap.has(dateStr);
      });

      if (sessionsWithSchedule.length > 0) {
        let adherenceCount = 0;
        const deviations: { type: string; date: string; minutes: number }[] = [];

        sessionsWithSchedule.forEach((session: any) => {
          const sessionDate = new Date(session.clock_in_time);
          const dateStr = sessionDate.toISOString().split('T')[0];
          const scheduled = scheduledMap.get(dateStr);
          if (!scheduled) return;

          const clockIn = new Date(session.clock_in_time);
          const clockOut = new Date(session.clock_out_time);
          let sessionAdheres = true;

          if (scheduled.start_time) {
            const expectedStart = parseTime(scheduled.start_time);
            if (expectedStart) {
              const expectedTime = new Date(sessionDate);
              expectedTime.setHours(expectedStart.hours, expectedStart.minutes, 0, 0);
              const diffMinutes = Math.round((clockIn.getTime() - expectedTime.getTime()) / (1000 * 60));
              if (Math.abs(diffMinutes) > 15) {
                sessionAdheres = false;
                deviations.push({ type: 'entrada', date: dateStr, minutes: diffMinutes });
              }
            }
          }

          if (scheduled.end_time) {
            const expectedEnd = parseTime(scheduled.end_time);
            if (expectedEnd) {
              const expectedTime = new Date(sessionDate);
              expectedTime.setHours(expectedEnd.hours, expectedEnd.minutes, 0, 0);
              const diffMinutes = Math.round((clockOut.getTime() - expectedTime.getTime()) / (1000 * 60));
              if (Math.abs(diffMinutes) > 15) {
                sessionAdheres = false;
                deviations.push({ type: 'salida', date: dateStr, minutes: diffMinutes });
              }
            }
          }

          if (sessionAdheres) adherenceCount++;
        });

        const adherenceRate = (adherenceCount / sessionsWithSchedule.length) * 100;
        if (adherenceRate >= 90) {
          strengths.push(`Cumplimiento del horario asignado: ${adherenceRate.toFixed(0)}% (${adherenceCount}/${sessionsWithSchedule.length} días)`);
        } else if (adherenceRate < 70) {
          areas_for_improvement.push(`Cumplimiento del horario asignado: ${adherenceRate.toFixed(0)}% (${adherenceCount}/${sessionsWithSchedule.length} días)`);
          const entryDeviations = deviations.filter(d => d.type === 'entrada').length;
          const exitDeviations = deviations.filter(d => d.type === 'salida').length;
          if (entryDeviations > exitDeviations) {
            recommendations.push('Revisar cumplimiento de horarios de entrada asignados');
          } else {
            recommendations.push('Revisar cumplimiento de horarios de salida asignados');
          }
        }
      }
    }

    // Analyze incidents
    const recentIncidents = (incidents || []).filter((i: any) => 
      new Date(i.created_at) >= threeMonthsAgo
    );
    const pendingIncidents = recentIncidents.filter((i: any) => i.status === 'pending');
    
    if (recentIncidents.length === 0) {
      strengths.push('Sin incidencias en los últimos 3 meses');
      recognition_suggestions.push('Reconocimiento por cumplimiento ejemplar');
    } else if (recentIncidents.length <= 2) {
      strengths.push(`Solo ${recentIncidents.length} incidencia(s) en 3 meses`);
    } else {
      areas_for_improvement.push(`${recentIncidents.length} incidencias en los últimos 3 meses`);
      if (pendingIncidents.length > 0) {
        recommendations.push(`Resolver ${pendingIncidents.length} incidencia(s) pendiente(s)`);
      }
    }

    // Analyze work on absence days
    if (absences && absences.length > 0 && events) {
      const workOnAbsenceDays = (events || []).filter((e: any) => {
        const eventDate = new Date(e.event_time);
        return absenceMap.has(eventDate.toISOString().split('T')[0]);
      });

      if (workOnAbsenceDays.length > 0) {
        areas_for_improvement.push(`${workOnAbsenceDays.length} fichaje(s) registrado(s) durante días de ausencia aprobada`);
        recommendations.push('Verificar si los fichajes durante ausencias son correctos o si hay un error en el registro');
      }
    }

    // Analyze pause duration (if there's a standard)
    if (sessions && sessions.length > 0) {
      const sessionsWithPauses = (sessions as any[]).filter((s: any) => 
        s.total_pause_duration && Number(s.total_pause_duration) > 0
      );
      
      if (sessionsWithPauses.length > 0) {
        const totalPauseMinutes = sessionsWithPauses.reduce((sum, s) => {
          const pauseMs = Number(s.total_pause_duration);
          return sum + (pauseMs / (1000 * 60));
        }, 0);
        const avgPauseMinutes = totalPauseMinutes / sessionsWithPauses.length;
        
        // Standard pause is typically 30-60 minutes, flag if consistently over 60
        if (avgPauseMinutes > 60) {
          areas_for_improvement.push(`Pausas más largas de lo normal (promedio: ${avgPauseMinutes.toFixed(0)}min)`);
          recommendations.push('Revisar política de pausas y comunicar tiempos esperados');
        } else if (avgPauseMinutes <= 45) {
          strengths.push(`Pausas dentro del tiempo razonable (promedio: ${avgPauseMinutes.toFixed(0)}min)`);
        }
      }
    }

    // Calculate performance trend based on compliance with scheduled hours
    let performance_trend: 'improving' | 'stable' | 'declining' = 'stable';
    let trend_percentage = 0;

    if (sessions && sessions.length >= 20 && scheduledHours && scheduledHours.length > 0) {
      const thisMonthSessions = (sessions as any[]).filter((s: any) => {
        const sessionDate = new Date(s.clock_in_time);
        return sessionDate >= monthStart && !absenceMap.has(sessionDate.toISOString().split('T')[0]);
      });
      const lastMonthSessions = (sessions as any[]).filter((s: any) => {
        const sessionDate = new Date(s.clock_in_time);
        return sessionDate >= lastMonthStart && sessionDate < monthStart && !absenceMap.has(sessionDate.toISOString().split('T')[0]);
      });

      if (thisMonthSessions.length > 0 && lastMonthSessions.length > 0) {
        let thisMonthCompliance = 0;
        let lastMonthCompliance = 0;

        thisMonthSessions.forEach((s: any) => {
          const dateStr = new Date(s.clock_in_time).toISOString().split('T')[0];
          const scheduled = scheduledMap.get(dateStr);
          if (scheduled && scheduled.expected_hours > 0) {
            const actual = calculateHours([s]);
            thisMonthCompliance += (actual / scheduled.expected_hours) * 100;
          }
        });

        lastMonthSessions.forEach((s: any) => {
          const dateStr = new Date(s.clock_in_time).toISOString().split('T')[0];
          const scheduled = scheduledMap.get(dateStr);
          if (scheduled && scheduled.expected_hours > 0) {
            const actual = calculateHours([s]);
            lastMonthCompliance += (actual / scheduled.expected_hours) * 100;
          }
        });

        const thisMonthAvg = thisMonthCompliance / thisMonthSessions.length;
        const lastMonthAvg = lastMonthCompliance / lastMonthSessions.length;

        if (lastMonthAvg > 0) {
          trend_percentage = ((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100;
          
          if (trend_percentage > 5) {
            performance_trend = 'improving';
          } else if (trend_percentage < -5) {
            performance_trend = 'declining';
          } else {
            performance_trend = 'stable';
          }
        }
      }
    }

    // Add general recommendations if no specific ones
    if (recommendations.length === 0 && areas_for_improvement.length > 0) {
      recommendations.push('Continuar monitoreando el rendimiento y proporcionar feedback regular');
    }

    if (strengths.length === 0) {
      strengths.push('Datos insuficientes para identificar fortalezas específicas. Asegúrate de que el owner haya asignado horarios programados.');
    }

    const insight: EmployeeInsight = {
      employee_id,
      employee_name: employeeName,
      strengths,
      areas_for_improvement,
      recommendations,
      performance_trend,
      recognition_suggestions: recognition_suggestions.length > 0 ? recognition_suggestions : undefined,
      trend_percentage: Math.abs(trend_percentage) > 0.1 ? trend_percentage : undefined,
    };

    return new Response(
      JSON.stringify(insight),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Employee insights error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Error al generar insights del empleado'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
