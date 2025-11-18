import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Anomaly {
  type: 'exact_time_pattern' | 'same_location' | 'perfect_pattern' | 'off_hours' | 'absence_conflict';
  employee_id: string;
  employee_name: string;
  description: string;
  confidence: number;
  evidence: string[];
}

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

    const { company_id } = await req.json().catch(() => ({}));

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all time events from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: timeEvents, error: eventsError } = await supabaseAdmin
      .from('time_events')
      .select(`
        id,
        user_id,
        event_type,
        event_time,
        latitude,
        longitude,
        profiles!inner(full_name, email)
      `)
      .eq('company_id', company_id)
      .gte('event_time', thirtyDaysAgo.toISOString())
      .order('event_time', { ascending: false });

    if (eventsError) {
      console.error('Error fetching time events:', eventsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch time events' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!timeEvents || timeEvents.length === 0) {
      return new Response(
        JSON.stringify({ anomalies: [], message: 'No events to analyze' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get absences for conflict detection
    const { data: absences } = await supabaseAdmin
      .from('absences')
      .select('user_id, start_date, end_date, status')
      .eq('company_id', company_id)
      .eq('status', 'approved');

    const anomalies: Anomaly[] = [];

    // Group events by user
    const eventsByUser = new Map<string, typeof timeEvents>();
    timeEvents.forEach((event: any) => {
      const userId = event.user_id;
      if (!eventsByUser.has(userId)) {
        eventsByUser.set(userId, []);
      }
      eventsByUser.get(userId)!.push(event);
    });

    // Analyze each user's events
    for (const [userId, userEvents] of eventsByUser.entries()) {
      const employeeName = userEvents[0]?.profiles?.full_name || userEvents[0]?.profiles?.email || 'Empleado desconocido';
      
      // Filter clock_in events for analysis
      const clockInEvents = userEvents.filter((e: any) => e.event_type === 'clock_in');
      
      if (clockInEvents.length < 5) continue; // Need at least 5 events to detect patterns

      // 1. Detect exact time pattern (always at the same exact second)
      const timePatterns = new Map<string, number>();
      clockInEvents.forEach((event: any) => {
        const eventTime = new Date(event.event_time);
        const timeKey = `${eventTime.getHours()}:${eventTime.getMinutes()}:${eventTime.getSeconds()}`;
        timePatterns.set(timeKey, (timePatterns.get(timeKey) || 0) + 1);
      });

      for (const [timeKey, count] of timePatterns.entries()) {
        if (count >= 5 && count / clockInEvents.length >= 0.7) {
          // 70% or more of clock-ins at exact same time
          const [hours, minutes, seconds] = timeKey.split(':');
          anomalies.push({
            type: 'exact_time_pattern',
            employee_id: userId,
            employee_name: employeeName,
            description: `Ficha siempre exactamente a las ${hours}:${minutes}:${seconds}. Posible automatización.`,
            confidence: Math.min(95, 60 + (count / clockInEvents.length) * 35),
            evidence: [
              `${count} de ${clockInEvents.length} fichajes a la misma hora exacta`,
              `Patrón detectado en los últimos 30 días`
            ]
          });
          break; // Only report once per user
        }
      }

      // 2. Detect same location pattern (multiple employees from same GPS)
      if (clockInEvents.some((e: any) => e.latitude && e.longitude)) {
        const locationGroups = new Map<string, typeof clockInEvents>();
        clockInEvents.forEach((event: any) => {
          if (event.latitude && event.longitude) {
            // Round to ~10 meters precision
            const latRounded = Math.round(event.latitude * 1000) / 1000;
            const lngRounded = Math.round(event.longitude * 1000) / 1000;
            const locationKey = `${latRounded},${lngRounded}`;
            
            if (!locationGroups.has(locationKey)) {
              locationGroups.set(locationKey, []);
            }
            locationGroups.get(locationKey)!.push(event);
          }
        });

        // Check if this location is shared with other employees
        for (const [locationKey, locationEvents] of locationGroups.entries()) {
          if (locationEvents.length >= 3) {
            // Check if other employees also use this location
            const otherUsersAtLocation = new Set<string>();
            timeEvents.forEach((event: any) => {
              if (event.user_id !== userId && event.latitude && event.longitude) {
                const latRounded = Math.round(event.latitude * 1000) / 1000;
                const lngRounded = Math.round(event.longitude * 1000) / 1000;
                if (`${latRounded},${lngRounded}` === locationKey) {
                  otherUsersAtLocation.add(event.user_id);
                }
              }
            });

            if (otherUsersAtLocation.size >= 2) {
              anomalies.push({
                type: 'same_location',
                employee_id: userId,
                employee_name: employeeName,
                description: `Múltiples empleados fichan desde la misma ubicación GPS. Verificar si están en el lugar correcto.`,
                confidence: 75,
                evidence: [
                  `${locationEvents.length} fichajes desde esta ubicación`,
                  `${otherUsersAtLocation.size + 1} empleados comparten esta ubicación`
                ]
              });
              break;
            }
          }
        }
      }

      // 3. Detect perfect pattern (too consistent, suspicious)
      if (clockInEvents.length >= 10) {
        const times = clockInEvents.map((e: any) => {
          const d = new Date(e.event_time);
          return d.getHours() * 60 + d.getMinutes(); // Minutes since midnight
        });
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);

        // If standard deviation is very low (< 2 minutes), it's suspiciously perfect
        if (stdDev < 2) {
          const avgHours = Math.floor(avgTime / 60);
          const avgMinutes = Math.floor(avgTime % 60);
          anomalies.push({
            type: 'perfect_pattern',
            employee_id: userId,
            employee_name: employeeName,
            description: `Patrón de fichajes demasiado perfecto. Ficha siempre alrededor de las ${String(avgHours).padStart(2, '0')}:${String(avgMinutes).padStart(2, '0')} con menos de 2 minutos de variación.`,
            confidence: 70,
            evidence: [
              `Desviación estándar: ${stdDev.toFixed(1)} minutos`,
              `${clockInEvents.length} fichajes analizados`
            ]
          });
        }
      }

      // 4. Detect off-hours pattern (fichajes fuera de horario normal)
      const hourCounts = new Map<number, number>();
      clockInEvents.forEach((event: any) => {
        const hour = new Date(event.event_time).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });

      // Check for significant activity outside 6-22 hours
      let offHoursCount = 0;
      for (const [hour, count] of hourCounts.entries()) {
        if (hour < 6 || hour >= 22) {
          offHoursCount += count;
        }
      }

      if (offHoursCount / clockInEvents.length >= 0.3) {
        anomalies.push({
          type: 'off_hours',
          employee_id: userId,
          employee_name: employeeName,
          description: `Fichajes frecuentes fuera de horario normal (30% o más entre 22:00-6:00). Verificar si es correcto.`,
          confidence: 65,
          evidence: [
            `${offHoursCount} de ${clockInEvents.length} fichajes fuera de horario`,
            'Horario normal esperado: 6:00-22:00'
          ]
        });
      }

      // 5. Detect absence conflicts
      if (absences) {
        const userAbsences = absences.filter((a: any) => a.user_id === userId);
        for (const absence of userAbsences) {
          const absenceStart = new Date(absence.start_date);
          const absenceEnd = new Date(absence.end_date);
          absenceEnd.setHours(23, 59, 59); // End of day

          const conflictingEvents = userEvents.filter((event: any) => {
            const eventDate = new Date(event.event_time);
            return eventDate >= absenceStart && eventDate <= absenceEnd;
          });

          if (conflictingEvents.length > 0) {
            anomalies.push({
              type: 'absence_conflict',
              employee_id: userId,
              employee_name: employeeName,
              description: `Fichajes registrados durante un período de ausencia aprobada (${absenceStart.toLocaleDateString('es-ES')} - ${absenceEnd.toLocaleDateString('es-ES')}).`,
              confidence: 90,
              evidence: [
                `${conflictingEvents.length} fichaje(s) durante la ausencia`,
                `Ausencia: ${absenceStart.toLocaleDateString('es-ES')} a ${absenceEnd.toLocaleDateString('es-ES')}`
              ]
            });
            break; // Only report once per absence
          }
        }
      }
    }

    // Get owners and admins to notify
    const { data: memberships } = await supabaseAdmin
      .from('memberships')
      .select('user_id')
      .eq('company_id', company_id)
      .in('role', ['owner', 'admin']);

    if (!memberships || memberships.length === 0) {
      return new Response(
        JSON.stringify({ anomalies, message: 'No owners/admins to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ownerAdminIds = memberships.map((m: any) => m.user_id);

    // Create notifications for each anomaly
    const notifications = [];
    for (const anomaly of anomalies) {
      // Only notify if confidence is high enough (>= 65%)
      if (anomaly.confidence >= 65) {
        for (const ownerId of ownerAdminIds) {
          notifications.push({
            company_id,
            user_id: ownerId,
            title: `⚠️ Anomalía detectada: ${anomaly.employee_name}`,
            message: anomaly.description,
            type: 'warning',
            entity_type: 'anomaly',
            entity_id: anomaly.employee_id,
          });
        }
      }
    }

    // Insert notifications in batch
    if (notifications.length > 0) {
      const { error: notifyError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);

      if (notifyError) {
        console.error('Error creating notifications:', notifyError);
      }
    }

    return new Response(
      JSON.stringify({
        anomalies: anomalies.length,
        notifications_created: notifications.length,
        message: `Detected ${anomalies.length} anomalies, created ${notifications.length} notifications`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Anomaly detection error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

