import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryContext {
  company_id: string;
  today: string;
  weekStart: string;
  monthStart: string;
  yearStart: string;
}

const parseDuration = (value?: string | null): number => {
  if (!value || value === "00:00:00") return 0;
  const parts = value.split(':').map((p) => Number(p));
  const [h = 0, m = 0, s = 0] = parts;
  return (
    (Number.isFinite(h) ? h : 0) +
    (Number.isFinite(m) ? m / 60 : 0) +
    (Number.isFinite(s) ? s / 3600 : 0)
  );
};

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

    const { question, company_id } = await req.json().catch(() => ({}));

    if (!question || !company_id) {
      return new Response(
        JSON.stringify({ error: 'question and company_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const questionLower = question.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const context: QueryContext = {
      company_id,
      today: today.toISOString(),
      weekStart: weekStart.toISOString(),
      monthStart: monthStart.toISOString(),
      yearStart: yearStart.toISOString(),
    };

    let answer = "";

    // ========== RETRASOS Y PUNTUALIDAD ==========
    if (questionLower.includes("tarde") || questionLower.includes("retraso") || questionLower.includes("llegó tarde") || questionLower.includes("llegaron tarde")) {
      const { data: arrivals } = await supabaseAdmin
        .from('time_events')
        .select(`id, event_time, profiles!inner(full_name, email)`)
        .eq('company_id', company_id)
        .eq('event_type', 'clock_in')
        .gte('event_time', context.today)
        .order('event_time', { ascending: false });

      if (arrivals && arrivals.length > 0) {
        const lateThreshold = new Date(today);
        lateThreshold.setHours(9, 0, 0, 0);
        
        const late = (arrivals as any[]).filter((event: any) => {
          const eventTime = new Date(event.event_time);
          return eventTime > lateThreshold;
        });

        if (late.length > 0) {
          const lateDetails = late.map((e: any) => {
            const time = new Date(e.event_time);
            const minutesLate = Math.round((time.getTime() - lateThreshold.getTime()) / (1000 * 60));
            return `${e.profiles?.full_name || e.profiles?.email} (${minutesLate} min tarde)`;
          }).join(", ");
          answer = `Hoy han llegado tarde ${late.length} empleado(s):\n${lateDetails}`;
        } else {
          answer = "✅ Hoy nadie ha llegado tarde. Todos los fichajes de entrada fueron antes de las 9:00 AM.";
        }
      } else {
        answer = "No hay fichajes de entrada registrados hoy todavía.";
      }
    }
    // ========== HORAS TRABAJADAS ==========
    else if (questionLower.includes("horas") && (questionLower.includes("semana") || questionLower.includes("esta semana"))) {
      const { data: sessions } = await supabaseAdmin
        .from('work_sessions')
        .select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration, user_id, profiles!inner(full_name, email)')
        .eq('company_id', company_id)
        .gte('clock_in_time', context.weekStart);

      if (sessions && sessions.length > 0) {
        const totalHours = calculateHours(sessions as any[]);
        const avgHours = totalHours / (sessions.length || 1);
        const { data: uniqueUsers } = await supabaseAdmin
          .from('work_sessions')
          .select('user_id')
          .eq('company_id', company_id)
          .gte('clock_in_time', context.weekStart);
        const uniqueCount = new Set((uniqueUsers || []).map((u: any) => u.user_id)).size;
        
        answer = `Esta semana se han trabajado ${totalHours.toFixed(1)} horas en total.\n\n📊 Detalles:\n- Promedio por sesión: ${avgHours.toFixed(1)} horas\n- Empleados que trabajaron: ${uniqueCount}\n- Total de sesiones: ${sessions.length}`;
      } else {
        answer = "No hay sesiones de trabajo registradas esta semana todavía.";
      }
    }
    else if (questionLower.includes("horas") && (questionLower.includes("hoy") || questionLower.includes("día") || questionLower.includes("hoy"))) {
      const { data: sessions } = await supabaseAdmin
        .from('work_sessions')
        .select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration, user_id, profiles!inner(full_name, email)')
        .eq('company_id', company_id)
        .gte('clock_in_time', context.today);

      if (sessions && sessions.length > 0) {
        const totalHours = calculateHours(sessions as any[]);
        const activeCount = sessions.filter((s: any) => !s.clock_out_time).length;
        const completedCount = sessions.filter((s: any) => s.clock_out_time).length;
        
        answer = `Hoy se han trabajado ${totalHours.toFixed(1)} horas en total.\n\n📊 Estado:\n- Sesiones completadas: ${completedCount}\n- Sesiones en curso: ${activeCount}\n- Total de sesiones: ${sessions.length}`;
      } else {
        answer = "No hay sesiones de trabajo registradas hoy todavía.";
      }
    }
    else if (questionLower.includes("horas") && (questionLower.includes("mes") || questionLower.includes("este mes"))) {
      const { data: sessions } = await supabaseAdmin
        .from('work_sessions')
        .select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration')
        .eq('company_id', company_id)
        .gte('clock_in_time', context.monthStart);

      if (sessions && sessions.length > 0) {
        const totalHours = calculateHours(sessions as any[]);
        const avgPerDay = totalHours / (new Date().getDate() || 1);
        answer = `Este mes se han trabajado ${totalHours.toFixed(1)} horas en total.\n\n📊 Promedio diario: ${avgPerDay.toFixed(1)} horas\nTotal de sesiones: ${sessions.length}`;
      } else {
        answer = "No hay sesiones de trabajo registradas este mes todavía.";
      }
    }
    else if (questionLower.includes("horas") && questionLower.includes("empleado") && (questionLower.includes("más") || questionLower.includes("top"))) {
      // Top employees by hours
      const { data: sessions } = await supabaseAdmin
        .from('work_sessions')
        .select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration, user_id, profiles!inner(full_name, email)')
        .eq('company_id', company_id)
        .gte('clock_in_time', context.monthStart);

      if (sessions && sessions.length > 0) {
        const userHours = new Map<string, { name: string; hours: number }>();
        (sessions as any[]).forEach((session: any) => {
          const userId = session.user_id;
          const name = session.profiles?.full_name || session.profiles?.email || 'Desconocido';
          if (!userHours.has(userId)) {
            userHours.set(userId, { name, hours: 0 });
          }
          const hours = calculateHours([session]);
          userHours.get(userId)!.hours += hours;
        });

        const sorted = Array.from(userHours.values())
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 5);
        
        const topList = sorted.map((u, i) => `${i + 1}. ${u.name}: ${u.hours.toFixed(1)}h`).join('\n');
        answer = `Top 5 empleados por horas trabajadas este mes:\n\n${topList}`;
      } else {
        answer = "No hay datos suficientes para calcular el ranking.";
      }
    }
    // ========== EMPLEADOS ACTIVOS ==========
    else if (questionLower.includes("activo") || questionLower.includes("trabajando") || questionLower.includes("ahora") || questionLower.includes("en este momento")) {
      const { data: activeSessions } = await supabaseAdmin
        .from('work_sessions')
        .select(`id, clock_in_time, profiles!inner(full_name, email)`)
        .eq('company_id', company_id)
        .eq('is_active', true);

      if (activeSessions && activeSessions.length > 0) {
        const details = (activeSessions as any[]).map((s: any) => {
          const startTime = new Date(s.clock_in_time);
          const hoursWorking = ((Date.now() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(1);
          return `${s.profiles?.full_name || s.profiles?.email} (${hoursWorking}h trabajando)`;
        }).join('\n');
        answer = `Actualmente hay ${activeSessions.length} empleado(s) trabajando:\n\n${details}`;
      } else {
        answer = "No hay empleados trabajando en este momento.";
      }
    }
    // ========== FICHAJES RECIENTES ==========
    else if (questionLower.includes("fichaje") || questionLower.includes("fichajes") || questionLower.includes("último") || questionLower.includes("reciente")) {
      const limit = questionLower.includes("último") || questionLower.includes("reciente") ? 10 : 5;
      const { data: recentEvents } = await supabaseAdmin
        .from('time_events')
        .select(`id, event_type, event_time, profiles!inner(full_name, email)`)
        .eq('company_id', company_id)
        .order('event_time', { ascending: false })
        .limit(limit);

      if (recentEvents && recentEvents.length > 0) {
        const eventsList = (recentEvents as any[]).map((e: any) => {
          const type = e.event_type === 'clock_in' ? '🟢 Entrada' : e.event_type === 'clock_out' ? '🔴 Salida' : 
                      e.event_type === 'pause_start' ? '☕ Pausa inicio' : e.event_type === 'pause_end' ? '✓ Pausa fin' : e.event_type;
          const time = new Date(e.event_time);
          const timeStr = time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const dateStr = time.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          return `${type} - ${e.profiles?.full_name || e.profiles?.email} a las ${timeStr} (${dateStr})`;
        }).join('\n');
        answer = `Los últimos ${limit} fichajes:\n\n${eventsList}`;
      } else {
        answer = "No hay fichajes recientes registrados.";
      }
    }
    // ========== INCIDENCIAS ==========
    else if (questionLower.includes("incidencia") || questionLower.includes("incidencias") || questionLower.includes("problema")) {
      const { data: incidents } = await supabaseAdmin
        .from('incidents')
        .select('id, type, description, created_at, status')
        .eq('company_id', company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (incidents && incidents.length > 0) {
        const types: Record<string, string> = {
          'missing_checkout': 'Fichaje sin salida',
          'missing_checkin': 'Fichaje sin entrada',
          'late_arrival': 'Llegada tardía',
          'early_departure': 'Salida temprana',
          'other': 'Otro'
        };
        const incidentsList = (incidents as any[]).slice(0, 5).map((inc: any, i: number) => {
          const typeName = types[inc.type] || inc.type;
          const date = new Date(inc.created_at).toLocaleDateString('es-ES');
          return `${i + 1}. ${typeName} - ${date}`;
        }).join('\n');
        answer = `Hay ${incidents.length} incidencia(s) pendiente(s):\n\n${incidentsList}\n\n💡 Deberías revisarlas en la sección de Incidencias.`;
      } else {
        answer = "✅ No hay incidencias pendientes. ¡Todo está en orden!";
      }
    }
    // ========== EMPLEADOS ==========
    else if ((questionLower.includes("empleado") || questionLower.includes("trabajador") || questionLower.includes("persona")) && 
             (questionLower.includes("cuántos") || questionLower.includes("total") || questionLower.includes("cuántas"))) {
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company_id);
      
      const { count: activeCount } = await supabaseAdmin
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company_id);

      answer = `Tu empresa tiene ${count || 0} empleado(s) registrado(s) en total.`;
    }
    else if (questionLower.includes("empleado") && (questionLower.includes("mejor") || questionLower.includes("más puntual") || questionLower.includes("puntualidad"))) {
      // Most punctual employee
      const { data: events } = await supabaseAdmin
        .from('time_events')
        .select(`user_id, event_time, event_type, profiles!inner(full_name, email)`)
        .eq('company_id', company_id)
        .eq('event_type', 'clock_in')
        .gte('event_time', context.monthStart);

      if (events && events.length > 0) {
        const userStats = new Map<string, { name: string; onTime: number; total: number }>();
        const onTimeThreshold = new Date();
        onTimeThreshold.setHours(9, 5, 0, 0); // 5 minutes tolerance

        (events as any[]).forEach((event: any) => {
          const userId = event.user_id;
          const name = event.profiles?.full_name || event.profiles?.email || 'Desconocido';
          if (!userStats.has(userId)) {
            userStats.set(userId, { name, onTime: 0, total: 0 });
          }
          const stats = userStats.get(userId)!;
          stats.total++;
          const eventTime = new Date(event.event_time);
          if (eventTime <= onTimeThreshold) {
            stats.onTime++;
          }
        });

        const sorted = Array.from(userStats.values())
          .filter(u => u.total >= 5) // At least 5 check-ins
          .map(u => ({ ...u, score: (u.onTime / u.total) * 100 }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (sorted.length > 0) {
          const topList = sorted.map((u, i) => 
            `${i + 1}. ${u.name}: ${u.score.toFixed(0)}% puntualidad (${u.onTime}/${u.total} días)`
          ).join('\n');
          answer = `Top empleados más puntuales este mes:\n\n${topList}`;
        } else {
          answer = "No hay suficientes datos para calcular la puntualidad.";
        }
      } else {
        answer = "No hay datos de fichajes suficientes.";
      }
    }
    // ========== AUSENCIAS ==========
    else if (questionLower.includes("ausencia") || questionLower.includes("ausencias") || questionLower.includes("vacaciones") || questionLower.includes("baja")) {
      const { data: absences } = await supabaseAdmin
        .from('absences')
        .select('id, start_date, end_date, absence_type, status, user_id, profiles!inner(full_name, email)')
        .eq('company_id', company_id)
        .gte('end_date', context.today)
        .order('start_date', { ascending: true });

      if (absences && absences.length > 0) {
        const active = (absences as any[]).filter((a: any) => a.status === 'approved');
        const types: Record<string, string> = {
          'vacation': '🏖️ Vacaciones',
          'sick_leave': '🏥 Baja médica',
          'personal': '👤 Personal',
          'other': '📅 Otro'
        };
        
        if (active.length > 0) {
          const absencesList = active.slice(0, 10).map((abs: any) => {
            const typeName = types[abs.absence_type] || abs.absence_type;
            const start = new Date(abs.start_date).toLocaleDateString('es-ES');
            const end = new Date(abs.end_date).toLocaleDateString('es-ES');
            return `${typeName} - ${abs.profiles?.full_name || abs.profiles?.email}: ${start} a ${end}`;
          }).join('\n');
          answer = `Hay ${active.length} ausencia(s) activa(s) o próximas:\n\n${absencesList}`;
        } else {
          answer = "No hay ausencias activas o próximas registradas.";
        }
      } else {
        answer = "No hay ausencias registradas.";
      }
    }
    // ========== ESTADÍSTICAS GENERALES ==========
    else if (questionLower.includes("estadística") || questionLower.includes("resumen") || questionLower.includes("resumen del día")) {
      const [activeRes, checkInsRes, incidentsRes, sessionsRes] = await Promise.all([
        supabaseAdmin.from('work_sessions').select('*', { count: 'exact', head: true }).eq('company_id', company_id).eq('is_active', true),
        supabaseAdmin.from('time_events').select('*', { count: 'exact', head: true }).eq('company_id', company_id).eq('event_type', 'clock_in').gte('event_time', context.today),
        supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true }).eq('company_id', company_id).eq('status', 'pending'),
        supabaseAdmin.from('work_sessions').select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration').eq('company_id', company_id).gte('clock_in_time', context.today)
      ]);

      const active = activeRes.count || 0;
      const checkIns = checkInsRes.count || 0;
      const incidents = incidentsRes.count || 0;
      const totalHours = calculateHours((sessionsRes.data || []) as any[]);

      answer = `📊 Resumen del día de hoy:\n\n✅ Empleados activos: ${active}\n📅 Fichajes de entrada: ${checkIns}\n⏱️ Horas trabajadas: ${totalHours.toFixed(1)}h\n⚠️ Incidencias pendientes: ${incidents}`;
    }
    // ========== COMPARATIVAS ==========
    else if (questionLower.includes("comparar") || questionLower.includes("comparación") || questionLower.includes("vs") || questionLower.includes("diferencia")) {
      const [todaySessions, yesterdaySessions] = await Promise.all([
        supabaseAdmin.from('work_sessions').select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration').eq('company_id', company_id).gte('clock_in_time', context.today),
        supabaseAdmin.from('work_sessions').select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration').eq('company_id', company_id).gte('clock_in_time', new Date(new Date(today).setDate(today.getDate() - 1)).toISOString()).lt('clock_in_time', context.today)
      ]);

      const todayHours = calculateHours((todaySessions.data || []) as any[]);
      const yesterdayHours = calculateHours((yesterdaySessions.data || []) as any[]);
      const diff = todayHours - yesterdayHours;
      const percentChange = yesterdayHours > 0 ? ((diff / yesterdayHours) * 100) : 0;

      answer = `📊 Comparación de horas:\n\nHoy: ${todayHours.toFixed(1)}h\nAyer: ${yesterdayHours.toFixed(1)}h\n\n${diff >= 0 ? '↑' : '↓'} Diferencia: ${Math.abs(diff).toFixed(1)}h (${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%)`;
    }
    // ========== PAUSAS ==========
    else if (questionLower.includes("pausa") || questionLower.includes("descanso")) {
      const { data: pauseEvents } = await supabaseAdmin
        .from('time_events')
        .select(`id, event_type, event_time, user_id, profiles!inner(full_name, email)`)
        .eq('company_id', company_id)
        .in('event_type', ['pause_start', 'pause_end'])
        .gte('event_time', context.today)
        .order('event_time', { ascending: false });

      if (pauseEvents && pauseEvents.length > 0) {
        const pauseCount = pauseEvents.filter((e: any) => e.event_type === 'pause_start').length;
        answer = `Hoy se han registrado ${pauseCount} pausa(s). Los empleados están tomando sus descansos correctamente.`;
      } else {
        answer = "No se han registrado pausas hoy todavía.";
      }
    }
    // ========== SOLICITUDES DE CORRECCIÓN ==========
    else if (questionLower.includes("corrección") || questionLower.includes("solicitud") || questionLower.includes("solicitudes")) {
      const { data: requests } = await supabaseAdmin
        .from('correction_requests')
        .select('id, status, created_at, user_id, profiles!inner(full_name, email)')
        .eq('company_id', company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requests && requests.length > 0) {
        const requestsList = (requests as any[]).slice(0, 5).map((r: any, i: number) => {
          const date = new Date(r.created_at).toLocaleDateString('es-ES');
          return `${i + 1}. ${r.profiles?.full_name || r.profiles?.email} - ${date}`;
        }).join('\n');
        answer = `Hay ${requests.length} solicitud(es) de corrección pendiente(s):\n\n${requestsList}\n\n💡 Revisa la sección de Solicitudes de Corrección para aprobarlas o rechazarlas.`;
      } else {
        answer = "✅ No hay solicitudes de corrección pendientes.";
      }
    }
    // ========== DISPOSITIVOS ==========
    else if (questionLower.includes("dispositivo") || questionLower.includes("tablet") || questionLower.includes("kiosco")) {
      const { data: devices } = await supabaseAdmin
        .from('devices')
        .select('id, name, is_active, company_id')
        .eq('company_id', company_id);

      if (devices && devices.length > 0) {
        const active = devices.filter((d: any) => d.is_active).length;
        answer = `Tu empresa tiene ${devices.length} dispositivo(s) registrado(s), de los cuales ${active} están activos.`;
      } else {
        answer = "No hay dispositivos registrados. Puedes añadirlos desde la sección de Dispositivos.";
      }
    }
    // ========== AYUDA Y FUNCIONALIDADES ==========
    else if (questionLower.includes("ayuda") || questionLower.includes("qué puedo") || questionLower.includes("cómo") || questionLower.includes("funciones") || questionLower.includes("qué hace")) {
      answer = `🤖 Puedo ayudarte con muchas cosas:\n\n📊 **Consultas de datos:**\n- "¿Quién ha llegado tarde hoy?"\n- "¿Cuántas horas se trabajaron esta semana?"\n- "¿Quién está trabajando ahora?"\n- "¿Cuáles son los últimos fichajes?"\n\n📈 **Estadísticas:**\n- "Dame un resumen del día"\n- "Compara las horas de hoy vs ayer"\n- "¿Quién es el empleado más puntual?"\n- "Top empleados por horas trabajadas"\n\n⚠️ **Gestión:**\n- "¿Hay incidencias pendientes?"\n- "¿Cuántas solicitudes de corrección hay?"\n- "¿Quién tiene ausencias próximas?"\n\n💡 **Información general:**\n- "¿Cuántos empleados tiene la empresa?"\n- "¿Cuántos dispositivos hay?"\n\n¡Pregúntame lo que necesites!`;
    }
    // ========== INFORMACIÓN SOBRE LA APP ==========
    else if (questionLower.includes("qué es") || questionLower.includes("qué hace esta app") || questionLower.includes("para qué sirve")) {
      answer = `GTiQ es un sistema de control horario que te permite:\n\n✅ Gestionar fichajes de empleados\n✅ Ver estadísticas en tiempo real\n✅ Programar horarios y ausencias\n✅ Detectar incidencias automáticamente\n✅ Generar reportes\n✅ Y mucho más\n\nEs una herramienta completa para administrar el tiempo de trabajo de tu equipo.`;
    }
    else if (questionLower.includes("cómo") && (questionLower.includes("invitar") || questionLower.includes("añadir empleado"))) {
      answer = `Para invitar un nuevo empleado:\n\n1. Ve a "Personas" en el menú\n2. Click en "Invitar Empleado"\n3. Completa el formulario:\n   - Email del empleado\n   - Nombre completo\n   - Rol (Owner, Admin, Manager, Worker)\n4. Click en "Enviar Invitación"\n\nEl empleado recibirá un email con instrucciones para acceder.`;
    }
    else if (questionLower.includes("cómo") && (questionLower.includes("programar") || questionLower.includes("horario"))) {
      answer = `Para programar horarios:\n\n1. Ve a "Calendario" en el Dashboard\n2. Selecciona un empleado de la lista\n3. Click en el día del calendario\n4. Click en "Programar Horas"\n5. Ingresa las horas esperadas (ej: 8)\n6. Añade notas opcionales\n7. Guarda\n\nTambién puedes usar "Asignar 8h estándar" para programación rápida.`;
    }
    else if (questionLower.includes("cómo") && (questionLower.includes("ausencia") || questionLower.includes("vacaciones"))) {
      answer = `Para registrar una ausencia:\n\n1. Ve a "Calendario"\n2. Selecciona el empleado\n3. Selecciona el día\n4. Click en "Registrar Ausencia"\n5. Selecciona tipo: Vacaciones, Baja médica, Personal, Otro\n6. Define fechas inicio y fin\n7. Añade motivo (opcional)\n8. Guarda\n\nTambién puedes usar "Marcar festivo de empresa" para aplicar a todos los empleados.`;
    }
    else if (questionLower.includes("cómo") && (questionLower.includes("reporte") || questionLower.includes("exportar"))) {
      answer = `Para generar reportes:\n\n1. Ve a "Reportes" en el Dashboard\n2. Selecciona tipo:\n   - Por Empleado: selecciona empleado y rango de fechas\n   - De Equipo: todos los empleados, rango de fechas\n3. Click en "Generar Reporte"\n4. Exporta:\n   - PDF para impresión\n   - Excel para análisis\n\nLos reportes incluyen horas trabajadas, fichajes, ausencias e incidencias.`;
    }
    // ========== PREGUNTAS ESPECÍFICAS POR EMPLEADO ==========
    else if (questionLower.includes("cuántas horas") && questionLower.includes("trabajó")) {
      // Extract employee name if mentioned
      const { data: employees } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .limit(100);
      
      const mentionedEmployee = (employees || []).find((emp: any) => 
        questionLower.includes(emp.full_name?.toLowerCase() || '') || 
        questionLower.includes(emp.email?.toLowerCase() || '')
      );

      if (mentionedEmployee) {
        const { data: sessions } = await supabaseAdmin
          .from('work_sessions')
          .select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration')
          .eq('company_id', company_id)
          .eq('user_id', mentionedEmployee.id)
          .gte('clock_in_time', context.monthStart);

        if (sessions && sessions.length > 0) {
          const totalHours = calculateHours(sessions as any[]);
          answer = `${mentionedEmployee.full_name || mentionedEmployee.email} ha trabajado ${totalHours.toFixed(1)} horas este mes.`;
        } else {
          answer = `No hay sesiones registradas para ${mentionedEmployee.full_name || mentionedEmployee.email} este mes.`;
        }
      } else {
        answer = "No pude identificar al empleado en tu pregunta. Intenta mencionar el nombre completo o el email.";
      }
    }
    // ========== PREGUNTAS SOBRE TENDENCIAS ==========
    else if (questionLower.includes("tendencia") || questionLower.includes("aumento") || questionLower.includes("disminuyó")) {
      const [thisWeekSessions, lastWeekSessions] = await Promise.all([
        supabaseAdmin.from('work_sessions').select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration').eq('company_id', company_id).gte('clock_in_time', context.weekStart),
        supabaseAdmin.from('work_sessions').select('clock_in_time, clock_out_time, total_work_duration, total_pause_duration').eq('company_id', company_id).gte('clock_in_time', new Date(new Date(weekStart).setDate(weekStart.getDate() - 7)).toISOString()).lt('clock_in_time', context.weekStart)
      ]);

      const thisWeek = calculateHours((thisWeekSessions.data || []) as any[]);
      const lastWeek = calculateHours((lastWeekSessions.data || []) as any[]);
      const diff = thisWeek - lastWeek;
      const percent = lastWeek > 0 ? ((diff / lastWeek) * 100) : 0;

      if (Math.abs(diff) < 0.1) {
        answer = `Las horas trabajadas se mantienen estables:\n\nEsta semana: ${thisWeek.toFixed(1)}h\nSemana pasada: ${lastWeek.toFixed(1)}h\n\nDiferencia: ${diff.toFixed(1)}h`;
      } else {
        answer = `📈 Tendencia de horas trabajadas:\n\nEsta semana: ${thisWeek.toFixed(1)}h\nSemana pasada: ${lastWeek.toFixed(1)}h\n\n${diff >= 0 ? '↑ Aumento' : '↓ Disminución'}: ${Math.abs(diff).toFixed(1)}h (${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%)`;
      }
    }
    // ========== RESPUESTA POR DEFECTO MEJORADA ==========
    else {
      answer = `Entiendo tu pregunta, pero necesito más contexto específico. Puedo ayudarte con:\n\n📊 **Consultas de datos:**\n- Retrasos y puntualidad\n- Horas trabajadas (hoy, semana, mes)\n- Empleados activos\n- Fichajes recientes\n\n📈 **Estadísticas:**\n- Resúmenes del día\n- Comparativas\n- Rankings de empleados\n- Tendencias\n\n⚠️ **Gestión:**\n- Incidencias\n- Solicitudes de corrección\n- Ausencias\n- Dispositivos\n\n💡 **Ayuda:**\n- Cómo usar funciones de la app\n- Información sobre el sistema\n\nIntenta reformular tu pregunta de forma más específica. Por ejemplo:\n- "¿Quién ha llegado tarde hoy?"\n- "¿Cuántas horas se trabajaron esta semana?"\n- "Dame un resumen del día"`;
    }

    return new Response(
      JSON.stringify({
        answer,
        question,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat assistant error:', error);
    return new Response(
      JSON.stringify({
        answer: "Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo o reformula tu pregunta de forma más específica.",
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
