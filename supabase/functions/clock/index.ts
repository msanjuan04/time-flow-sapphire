import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'

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
    return new Response('ok', { status: 200, headers: corsHeaders });
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
    const { action, latitude, longitude, photo_url, device_id, source = 'web', user_id, company_id } = body;

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
        JSON.stringify({ error: 'No autenticado o user_id no proporcionado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notifyUsers = async (userIds: string[], payload: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error'; entity_type?: string | null; entity_id?: string | null; company_id: string }) => {
      if (!userIds.length) return;
      try {
        await supabaseAdmin.from('notifications').insert(
          userIds.map((userId) => ({
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
          entity_type: 'incident',
          entity_id: incident?.id || null,
        });
      } catch (error) {
        console.error('Failed to report incident:', error);
      }
    };

    console.log('Clock request:', { user_id: currentUserId, action, source, company_id });

    // Get user's company membership
    let membershipQuery = supabaseAdmin
      .from('memberships')
      .select('company_id, company:companies(id, name, status)')
      .eq('user_id', currentUserId);
    
    // If company_id is provided, filter by it
    if (company_id) {
      membershipQuery = membershipQuery.eq('company_id', company_id);
    }
    
    const { data: memberships, error: membershipError } = await membershipQuery;

    if (membershipError || !memberships || memberships.length === 0) {
      console.error('Membership error:', membershipError);
      return new Response(
        JSON.stringify({ error: 'Usuario sin empresa asignada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the first membership (or the one matching company_id if provided)
    const membership = memberships[0] as any;

    const companyId = membership.company_id;
    const company = Array.isArray(membership.company) ? membership.company[0] : membership.company;

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
        JSON.stringify({ error: 'Empresa suspendida. Contacta con administración.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current active session
    const { data: activeSession } = await supabaseAdmin
      .from('work_sessions')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();

    // Determine event type based on action
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
          JSON.stringify({ error: 'Acción inválida' }),
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
        JSON.stringify({ error: 'Ya tienes una sesión activa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((action === 'out' || action === 'break_start' || action === 'break_end') && !activeSession) {
      await reportIncident({
        type: 'missing_checkin',
        description: `El empleado intentó registrar ${action} sin tener una sesión abierta.`,
        notifyMessage: 'Se detectó un intento de fichaje sin entrada previa.',
      });
      return new Response(
        JSON.stringify({ error: 'No tienes ninguna sesión activa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert time event
    const { error: eventError } = await supabaseAdmin.from('time_events').insert({
      user_id: currentUserId,
      company_id: companyId,
      event_type: eventType,
      source,
      device_id: device_id || null,
      latitude: latitude || null,
      longitude: longitude || null,
      photo_url: photo_url || null,
      event_time: new Date().toISOString(),
    });

    if (eventError) {
      console.error('Event insert error:', eventError);
      await reportIncident({
        type: 'other',
        description: 'Error de base de datos al registrar el evento de fichaje.',
        notifyMessage: 'El sistema no pudo registrar un fichaje por un error interno.',
        severity: 'error',
      });
      return new Response(
        JSON.stringify({ error: 'Error al registrar evento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create work session
    if (action === 'in') {
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
          JSON.stringify({ error: 'Error al crear sesión' }),
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
          JSON.stringify({ error: 'Error al cerrar sesión' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    // In case of total failure, we cannot determine company/user safely for incident
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
