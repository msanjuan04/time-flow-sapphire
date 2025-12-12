import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'
import { GEOFENCE_RADIUS_METERS, calculateDistanceMeters } from '../_shared/geofence.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

interface ClockRequest {
  action: 'in' | 'out' | 'break_start' | 'break_end';
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  device_id?: string;
  source?: 'mobile' | 'web' | 'kiosk';
  user_id?: string; // For kiosk mode
  company_id?: string; // Active company
  notes?: string;
}

interface MembershipResult {
  company_id: string;
  company: {
    id: string;
    name: string;
    status: string;
  } | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); // FIX ensure JSON preflight response
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get request body
    const body: ClockRequest = await req.json();
    const { action, latitude, longitude, photo_url, device_id, source = 'web', user_id, company_id, notes } = body;
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);

    let currentUserId: string;

    // Check if authenticated user or if user_id is provided (for kiosk)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      currentUserId = user.id;
    } else if (user_id) {
      // Kiosk mode - user_id provided
      currentUserId = user_id;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado o user_id no proporcionado' }), // FIX always return JSON shape
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------
    // Day-type rules (domingo, festivos, días especiales)
    // -------------------------------------------------------------------
    const dayOfWeek = now.getUTCDay(); // 0 = domingo
    let isHoliday = false;
    let isSpecialDay = false;

    // Regla global
    let companyDayRules: {
      allow_sunday_clock?: boolean;
      holiday_clock_policy?: 'allow' | 'require_reason' | 'block';
      special_day_policy?: 'allow' | 'restrict';
    } | null = null;
    try {
      const { data } = await supabaseAdmin
        .from('company_day_rules')
        .select('allow_sunday_clock, holiday_clock_policy, special_day_policy')
        .eq('company_id', companyId)
        .maybeSingle();
      companyDayRules = data;
    } catch (err) {
      console.error('No se pudo obtener company_day_rules', err);
    }

    // Regla individual
    let workerDayRules: {
      allow_sunday_clock?: boolean | null;
      holiday_clock_policy?: 'allow' | 'require_reason' | 'block' | null;
      special_day_policy?: 'allow' | 'restrict' | null;
    } | null = null;
    try {
      const { data } = await supabaseAdmin
        .from('worker_day_rules')
        .select('allow_sunday_clock, holiday_clock_policy, special_day_policy')
        .eq('company_id', companyId)
        .eq('user_id', currentUserId)
        .maybeSingle();
      workerDayRules = data;
    } catch (err) {
      console.error('No se pudo obtener worker_day_rules', err);
    }

    // Detectar festivo
    try {
      const { data } = await supabaseAdmin
        .from('public_holidays')
        .select('id')
        .eq('date', todayIso)
        .maybeSingle();
      isHoliday = !!data;
    } catch (err) {
      // Tabla puede no existir en algunos entornos
      console.error('Error comprobando festivos', err);
    }

    // Detectar día especial por empresa (tabla opcional)
    try {
      const { data } = await supabaseAdmin
        .from('company_special_days')
        .select('id')
        .eq('company_id', companyId)
        .eq('date', todayIso)
        .maybeSingle();
      isSpecialDay = !!data;
    } catch (err) {
      // Tabla opcional; si no existe, ignoramos
      if (!`${err}`.includes('42P01')) {
        console.error('Error comprobando días especiales', err);
      }
    }

    const effectiveAllowSunday =
      typeof workerDayRules?.allow_sunday_clock === 'boolean'
        ? workerDayRules.allow_sunday_clock
        : companyDayRules?.allow_sunday_clock ?? false;
    const effectiveHolidayPolicy =
      workerDayRules?.holiday_clock_policy ?? companyDayRules?.holiday_clock_policy ?? 'block';
    const effectiveSpecialPolicy =
      workerDayRules?.special_day_policy ?? companyDayRules?.special_day_policy ?? 'restrict';

    if (dayOfWeek === 0 && !effectiveAllowSunday) {
      return new Response(
        JSON.stringify({ success: false, error: 'DAY_POLICY_VIOLATION', reason: 'sunday_blocked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isHoliday) {
      if (effectiveHolidayPolicy === 'block') {
        return new Response(
          JSON.stringify({ success: false, error: 'DAY_POLICY_VIOLATION', reason: 'holiday_blocked' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (effectiveHolidayPolicy === 'require_reason') {
        const reason = notes || (body as any)?.reason;
        if (!reason || String(reason).trim().length < 3) {
          return new Response(
            JSON.stringify({ success: false, error: 'DAY_POLICY_VIOLATION', reason: 'holiday_requires_reason' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (isSpecialDay && effectiveSpecialPolicy === 'restrict') {
      return new Response(
        JSON.stringify({ success: false, error: 'DAY_POLICY_VIOLATION', reason: 'special_day_restricted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notifyUsers = async (
      userIds: string[],
      payload: {
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
        entity_type?: string | null;
        entity_id?: string | null;
        company_id: string;
      },
      options?: {
        deduplicateByEntity?: boolean;
      }
    ) => {
      let targetUserIds = Array.from(new Set(userIds));

      if (!targetUserIds.length) return;
      try {
        if (options?.deduplicateByEntity && payload.entity_type && payload.entity_id) {
          const { data: existing } = await supabaseAdmin
            .from('notifications')
            .select('user_id')
            .eq('company_id', payload.company_id)
            .eq('entity_type', payload.entity_type)
            .eq('entity_id', payload.entity_id)
            .in('user_id', targetUserIds);

          if (existing?.length) {
            const alreadyNotified = new Set(existing.map((row: any) => row.user_id));
            targetUserIds = targetUserIds.filter((id) => !alreadyNotified.has(id));
          }
        }

        if (!targetUserIds.length) return;

        await supabaseAdmin.from('notifications').insert(
          targetUserIds.map((userId) => ({
            company_id: payload.company_id,
            user_id: userId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            entity_type: payload.entity_type || null,
            entity_id: payload.entity_id || null,
          }))
        );
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
      }
    };

    const reportIncident = async (params: {
      type: 'late_arrival' | 'early_departure' | 'missing_checkout' | 'missing_checkin' | 'other';
      description: string;
      notifyMessage: string;
      severity?: 'info' | 'success' | 'warning' | 'error';
    }) => {
      try {
        const incidentDate = new Date().toISOString().split('T')[0];
        const { data: incident, error: incidentError } = await supabaseAdmin
          .from('incidents')
          .insert({
            user_id: currentUserId,
            company_id: companyId,
            incident_type: params.type,
            incident_date: incidentDate,
            description: params.description,
          })
          .select()
          .single();

        if (incidentError) {
          console.error('Failed to create incident:', incidentError);
          return;
        }

        const { data: admins } = await supabaseAdmin
          .from('memberships')
          .select('user_id')
          .eq('company_id', companyId)
          .in('role', ['owner', 'admin', 'manager']);

        const recipients = new Set<string>();
        (admins || []).forEach((m: { user_id: string }) => recipients.add(m.user_id));
        recipients.add(currentUserId);

        await notifyUsers(Array.from(recipients), {
          company_id: companyId,
          title: 'Incidencia de fichaje',
          message: params.notifyMessage,
          type: params.severity || 'warning',
          // Deduplicamos por sesión excedida para no silenciar notificaciones de nuevas incidencias distintas
          entity_type: params.type === 'missing_checkout' ? 'work_session' : 'incident',
          entity_id: params.type === 'missing_checkout' ? incident?.id || null : incident?.id || null,
        });

        console.log('Incident created and notifications queued', {
          incident_id: incident?.id,
          recipients: Array.from(recipients),
          type: params.type,
        });
      } catch (error) {
        console.error('Failed to report incident:', error);
      }
    };

    console.log('Clock request:', { user_id: currentUserId, action, source, company_id });

    // Get user's company membership
    let membershipQuery = supabaseAdmin
      .from('memberships')
      .select(
        `company_id,
         company:companies(
          id,
          name,
          status,
          hq_lat,
          hq_lng,
          max_shift_hours,
          entry_early_minutes,
          entry_late_minutes,
          exit_early_minutes,
          exit_late_minutes
        )`
      )
      .eq('user_id', currentUserId);
    
    // If company_id is provided, filter by it
    if (company_id) {
      membershipQuery = membershipQuery.eq('company_id', company_id);
    }
    
    const { data: memberships, error: membershipError } = await membershipQuery;

    if (membershipError || !memberships || memberships.length === 0) {
      console.error('Membership error:', membershipError);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario sin empresa asignada' }), // FIX include success flag on error
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the first membership (or the one matching company_id if provided)
    const membership = memberships[0] as any;

    const companyId = membership.company_id;
    const company = Array.isArray(membership.company) ? membership.company[0] : membership.company;
    const entryEarly = Number.isFinite(company?.entry_early_minutes) ? Number(company.entry_early_minutes) : 10;
    const entryLate = Number.isFinite(company?.entry_late_minutes) ? Number(company.entry_late_minutes) : 15;
    const exitEarly = Number.isFinite(company?.exit_early_minutes) ? Number(company.exit_early_minutes) : 10;
    const exitLate = Number.isFinite(company?.exit_late_minutes) ? Number(company.exit_late_minutes) : 15;

    // Check if company is active
    if (company?.status === 'suspended') {
      console.error('Company suspended:', companyId);
      await reportIncident({
        type: 'other',
        description: 'Intento de fichar con empresa suspendida',
        notifyMessage: 'Un empleado intentó fichar mientras la empresa está suspendida.',
        severity: 'error',
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Empresa suspendida. Contacta con administración.' }), // FIX consistent error envelope
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------
    // Compliance settings by company (if configured)
    // -------------------------------------------------------------------
    const { data: compliance } = await supabaseAdmin
      .from('company_compliance_settings')
      .select(
        'max_week_hours, max_month_hours, min_hours_between_shifts, allowed_checkin_start, allowed_checkin_end, allow_outside_schedule'
      )
      .eq('company_id', companyId)
      .maybeSingle();

    const toMinutes = (t?: string | null) => {
      if (!t) return null;
      const [h, m] = String(t).split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    const allowOutsideSchedule =
      typeof compliance?.allow_outside_schedule === 'boolean' ? compliance.allow_outside_schedule : true;

    // Allowed check-in window (aplica a cualquier acción)
    if (!allowOutsideSchedule && compliance?.allowed_checkin_start && compliance?.allowed_checkin_end) {
      const startMin = toMinutes(compliance.allowed_checkin_start);
      const endMin = toMinutes(compliance.allowed_checkin_end);
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const enforceWindow =
        startMin !== null &&
        endMin !== null &&
        !(startMin === 0 && endMin === 0); // 00:00-00:00 se interpreta como apagado
      if (
        enforceWindow &&
        (currentMin < startMin || currentMin > endMin)
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'LEGAL_RESTRICTION',
            reason: 'outside_allowed_hours',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get current active session
    let { data: activeSession } = await supabaseAdmin
      .from('work_sessions')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();

    const maxShiftHours =
      typeof company?.max_shift_hours === 'number' && !Number.isNaN(company.max_shift_hours)
        ? Number(company.max_shift_hours)
        : null;

    // Auto-close sessions that exceeded the configured limit so the worker can start a new one
    let exceededSession: typeof activeSession | null = null;
    if (activeSession && maxShiftHours !== null) {
      const startedAt = new Date(activeSession.clock_in_time);
      const now = new Date();
      const elapsedHours = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

      if (elapsedHours > maxShiftHours) {
        const cappedOut = new Date(startedAt.getTime() + maxShiftHours * 60 * 60 * 1000).toISOString();
        const { error: exceedUpdateError } = await supabaseAdmin
          .from('work_sessions')
          .update({
            clock_out_time: cappedOut,
            is_active: false,
            status: 'auto_closed',
            review_status: 'exceeded_limit',
          })
          .eq('id', activeSession.id);

        if (!exceedUpdateError) {
          exceededSession = { ...activeSession, clock_out_time: cappedOut, is_active: false, status: 'auto_closed' };
          // Liberamos al trabajador para que pueda iniciar una nueva sesión
          activeSession = null;

          await reportIncident({
            type: 'missing_checkout',
            description: 'Sesión superó el máximo de horas permitido y fue marcada para revisión.',
            notifyMessage: 'Se detectó una fichada que superó el límite configurado. Revisar y ajustar horas.',
            severity: 'warning',
          });
        } else {
          console.error('No se pudo marcar la sesión excedida:', exceedUpdateError);
        }
      }
    }

    // Fetch horario programado para hoy (se reutiliza abajo)
    let scheduled: { start_time?: string | null; end_time?: string | null; expected_hours?: number | null } | null = null;
    try {
      const { data: scheduledData } = await supabaseAdmin
        .from('scheduled_hours')
        .select('start_time, end_time, expected_hours')
        .eq('user_id', currentUserId)
        .eq('company_id', companyId)
        .eq('date', todayIso)
        .maybeSingle();
      if (scheduledData) scheduled = scheduledData;
    } catch (err) {
      console.error('Error fetching scheduled hours for today', err);
    }

    // Determina tipo de evento según acción
    let eventType: string;
    switch (action) {
      case 'in':
        eventType = 'clock_in';
        break;
      case 'out':
        eventType = 'clock_out';
        break;
      case 'break_start':
        eventType = 'pause_start';
        break;
      case 'break_end':
        eventType = 'pause_end';
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Acción inválida' }), // FIX consistent error envelope
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Validate action based on current state
    if (action === 'in' && activeSession) {
      await reportIncident({
        type: 'missing_checkout',
        description: 'El empleado intentó fichar entrada con una sesión previa abierta.',
        notifyMessage: 'Una sesión previa quedó abierta y el sistema bloqueó un nuevo fichaje de entrada.',
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Ya tienes una sesión activa' }), // FIX consistent error envelope
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((action === 'out' || action === 'break_start' || action === 'break_end') && !activeSession) {
      if (exceededSession) {
        return new Response(
          JSON.stringify({ success: false, error: 'shift_exceeded_max_hours' }), // FIX consistent error envelope
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await reportIncident({
        type: 'missing_checkin',
        description: `El empleado intentó registrar ${action} sin tener una sesión abierta.`,
        notifyMessage: 'Se detectó un intento de fichaje sin entrada previa.',
      });
      return new Response(
        JSON.stringify({ success: false, error: 'No tienes ninguna sesión activa' }), // FIX consistent error envelope
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validación de márgenes de fichaje respecto al horario
    const parseTimeToMinutes = (t?: string | null) => {
      if (!t) return null;
      const [h, m] = String(t).split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    const withinScheduleWindow = () => {
      const current = new Date();
      const currentMinutes = current.getHours() * 60 + current.getMinutes();
      const startMinutes = parseTimeToMinutes(scheduled?.start_time);
      const endMinutes = parseTimeToMinutes(scheduled?.end_time);
      const expectedHours =
        typeof scheduled?.expected_hours === 'number'
          ? scheduled.expected_hours
          : Number(scheduled?.expected_hours ?? 0);

      if (allowOutsideSchedule) return { ok: true };

      // Si no hay horario con horas asignadas, no bloqueamos fichajes por horario
      const shouldEnforceSchedule =
        Boolean(scheduled) && expectedHours > 0 && startMinutes !== null && endMinutes !== null;
      if (!shouldEnforceSchedule) return { ok: true };

      if (action === 'in') {
        const minAllowed = startMinutes - entryEarly;
        const maxAllowed = startMinutes + entryLate;
        if (currentMinutes < minAllowed) {
          return { ok: false, msg: 'No puedes fichar todavía' };
        }
        if (currentMinutes > maxAllowed) {
          return { ok: false, msg: 'Ya no puedes fichar' };
        }
      }
      if (action === 'out') {
        const minAllowed = endMinutes - exitEarly;
        const maxAllowed = endMinutes + exitLate;
        if (currentMinutes < minAllowed) {
          return { ok: false, msg: 'No puedes fichar todavía' };
        }
        if (currentMinutes > maxAllowed) {
          return { ok: false, msg: 'Ya no puedes fichar' };
        }
      }
      return { ok: true };
    };

    const scheduleCheck = withinScheduleWindow();
    if (!scheduleCheck.ok) {
      return new Response(
        JSON.stringify({ success: false, error: scheduleCheck.msg }), // FIX consistent error envelope
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let distanceMeters: number | null = null;
    let isWithinGeofence: boolean | null = null;

    const hasCompanyLocation = typeof company?.hq_lat === 'number' && typeof company?.hq_lng === 'number';
    const hasWorkerLocation = typeof latitude === 'number' && typeof longitude === 'number';

    if (hasCompanyLocation && hasWorkerLocation) {
      distanceMeters = calculateDistanceMeters(latitude!, longitude!, company.hq_lat!, company.hq_lng!);
      isWithinGeofence = distanceMeters <= GEOFENCE_RADIUS_METERS;
    }

    // Insert time event
    const { data: newEvent, error: eventError } = await supabaseAdmin
      .from('time_events')
      .insert({
        user_id: currentUserId,
        company_id: companyId,
        event_type: eventType,
        source,
        device_id: device_id || null,
        latitude: latitude || null,
        longitude: longitude || null,
        distance_meters: distanceMeters,
        is_within_geofence: isWithinGeofence,
        photo_url: photo_url || null,
        notes: notes || null,
        event_time: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (eventError) {
      console.error('Event insert error:', eventError);
      await reportIncident({
        type: 'other',
        description: 'Error de base de datos al registrar el evento de fichaje.',
        notifyMessage: 'El sistema no pudo registrar un fichaje por un error interno.',
        severity: 'error',
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Error al registrar evento' }), // FIX consistent error envelope
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create work session
    if (action === 'in') {
      // Compliance checks before opening a new session
      if (compliance) {
        // Horas acumuladas semana/mes
        const weekStart = new Date(now);
        weekStart.setUTCHours(0, 0, 0, 0);
        // date_trunc('week') estilo lunes: restar day? Para simplicidad: se toma lunes como inicio:
        const day = weekStart.getUTCDay(); // 0 domingo
        const diff = (day === 0 ? 6 : day - 1); // días desde lunes
        weekStart.setUTCDate(weekStart.getUTCDate() - diff);

        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

        const fetchSessionsSum = async (from: Date) => {
          const { data: sessions } = await supabaseAdmin
            .from('work_sessions')
            .select('clock_in_time, clock_out_time')
            .eq('user_id', currentUserId)
            .eq('company_id', companyId)
            .eq('is_active', false)
            .gte('clock_in_time', from.toISOString())
            .lte('clock_in_time', now.toISOString());
          let hours = 0;
          (sessions || []).forEach((s: any) => {
            if (s.clock_in_time && s.clock_out_time) {
              const start = new Date(s.clock_in_time).getTime();
              const end = new Date(s.clock_out_time).getTime();
              if (end > start) {
                hours += (end - start) / (1000 * 60 * 60);
              }
            }
          });
          return hours;
        };

        const weekHours = compliance.max_week_hours
          ? await fetchSessionsSum(weekStart)
          : 0;
        if (compliance.max_week_hours && weekHours >= compliance.max_week_hours) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'LEGAL_RESTRICTION',
            reason: 'exceeded_week_hours',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        }

        const monthHours = compliance.max_month_hours
          ? await fetchSessionsSum(monthStart)
          : 0;
        if (compliance.max_month_hours && monthHours >= compliance.max_month_hours) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'LEGAL_RESTRICTION',
              reason: 'exceeded_month_hours',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (compliance.min_hours_between_shifts) {
          const { data: lastSession } = await supabaseAdmin
            .from('work_sessions')
            .select('clock_out_time')
            .eq('user_id', currentUserId)
            .eq('company_id', companyId)
            .eq('is_active', false)
            .not('clock_out_time', 'is', null)
            .order('clock_out_time', { ascending: false })
            .limit(1);

          if (lastSession && lastSession.length > 0) {
            const lastOut = new Date(lastSession[0].clock_out_time);
            const diffHours = (now.getTime() - lastOut.getTime()) / (1000 * 60 * 60);
            if (diffHours < compliance.min_hours_between_shifts) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: 'LEGAL_RESTRICTION',
                  reason: 'too_soon_between_shifts',
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }
      }

      // Create new session
      const { error: sessionError } = await supabaseAdmin.from('work_sessions').insert({
        user_id: currentUserId,
        company_id: companyId,
        clock_in_time: new Date().toISOString(),
        is_active: true,
        status: 'open',
      });

      if (sessionError) {
        console.error('Session insert error:', sessionError);
        await reportIncident({
          type: 'other',
          description: 'No se pudo crear la sesión de trabajo del empleado.',
          notifyMessage: 'Un fichaje no pudo crear su sesión correspondiente.',
          severity: 'error',
        });
        return new Response(
          JSON.stringify({ success: false, error: 'Error al crear sesión' }), // FIX consistent error envelope
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (action === 'out' && activeSession) {
      // Close session
      const { error: updateError } = await supabaseAdmin
        .from('work_sessions')
        .update({
          clock_out_time: new Date().toISOString(),
          is_active: false,
          status: 'closed',
        })
        .eq('id', activeSession.id);

      if (updateError) {
        console.error('Session update error:', updateError);
        await reportIncident({
          type: 'other',
          description: 'No se pudo cerrar la sesión de trabajo activa del empleado.',
          notifyMessage: 'Un fichaje de salida falló al cerrar la sesión.',
          severity: 'error',
        });
        return new Response(
          JSON.stringify({ success: false, error: 'Error al cerrar sesión' }), // FIX consistent error envelope
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (isWithinGeofence === false) {
      const { data: admins } = await supabaseAdmin
        .from('memberships')
        .select('user_id')
        .eq('company_id', companyId)
        .in('role', ['owner', 'admin', 'manager']);

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', currentUserId)
        .maybeSingle();

      const recipientIds = Array.from(new Set((admins || []).map((m: any) => m.user_id)));
      const distanceLabel = typeof distanceMeters === 'number' ? `${Math.round(distanceMeters)} m` : 'distancia no disponible';
      const coordinatesLabel =
        typeof latitude === 'number' && typeof longitude === 'number'
          ? `(${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
          : 'sin coordenadas';
      const userLabel = profile?.full_name || profile?.email || 'Empleado';
      const actionLabels: Record<ClockRequest['action'], string> = {
        in: 'una entrada',
        out: 'una salida',
        break_start: 'el inicio de una pausa',
        break_end: 'el fin de una pausa',
      };

      await notifyUsers(
        recipientIds,
        {
          company_id: companyId,
          title: 'Fichaje fuera de zona',
          message: `${userLabel} registró ${actionLabels[action]} fuera del punto configurado (${distanceLabel} del centro). Ubicación reportada: ${coordinatesLabel}.`,
          type: 'warning',
          entity_type: 'time_event',
          entity_id: newEvent?.id || null,
        },
        { deduplicateByEntity: true }
      );
    }

    // Aviso por fichaje fuera del horario programado del día (solo en entrada)
    if (action === 'in') {
      try {
        if (scheduled?.start_time && scheduled?.end_time && Number(scheduled.expected_hours) > 0) {
          const now = new Date();
          const [sh, sm] = String(scheduled.start_time).split(':').map(Number);
          const [eh, em] = String(scheduled.end_time).split(':').map(Number);
          const startMinutes = sh * 60 + sm;
          const endMinutes = eh * 60 + em;
          const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

          if (
            Number.isFinite(startMinutes) &&
            Number.isFinite(endMinutes) &&
            (currentMinutes < startMinutes || currentMinutes > endMinutes)
          ) {
            const { data: admins } = await supabaseAdmin
              .from('memberships')
              .select('user_id')
              .eq('company_id', companyId)
              .in('role', ['owner', 'admin', 'manager']);

            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('full_name, email')
              .eq('id', currentUserId)
              .maybeSingle();

            const recipientIds = Array.from(new Set((admins || []).map((m: any) => m.user_id)));
            const userLabel = profile?.full_name || profile?.email || 'Empleado';
            // Deduplicamos por día para no repetir avisos del mismo empleado fuera de horario
            const dedupEntityId = `${currentUserId}-${todayIso}-schedule-out-of-hours`;
            await notifyUsers(
              recipientIds,
              {
                company_id: companyId,
                title: 'Fichaje fuera de horario',
                message: `${userLabel} registró un fichaje (${action}) fuera de su horario programado de hoy.`,
                type: 'warning',
                entity_type: 'time_event',
                entity_id: dedupEntityId,
              },
              { deduplicateByEntity: true }
            );
          }
        }
      } catch (scheduleNotifyError) {
        console.error('Schedule notification check failed:', scheduleNotifyError);
      }
    }

    // Determine current status
    let currentStatus: 'working' | 'paused' | 'off';
    if (action === 'out') {
      currentStatus = 'off';
    } else if (action === 'break_start') {
      currentStatus = 'paused';
    } else {
      currentStatus = 'working';
    }

    console.log('Clock action completed:', { user_id: currentUserId, action, status: currentStatus });

    return new Response(
      JSON.stringify({
        success: true,
        status: currentStatus,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        distance_meters: distanceMeters,
        is_within_geofence: isWithinGeofence,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    // In case of total failure, we cannot determine company/user safely for incident
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }), // FIX consistent error envelope
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
