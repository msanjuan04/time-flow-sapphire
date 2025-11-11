import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClockRequest {
  action: 'in' | 'out' | 'break_start' | 'break_end';
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  device_id?: string;
  source?: 'mobile' | 'web' | 'kiosk';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const body: ClockRequest = await req.json();
    const { action, latitude, longitude, photo_url, device_id, source = 'web' } = body;

    console.log('Clock request:', { user_id: user.id, action, source });

    // Get user's company membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('company_id, company:companies(id, name, status)')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error('Membership error:', membershipError);
      return new Response(
        JSON.stringify({ error: 'Usuario sin empresa asignada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = membership.company_id;
    const company = membership.company as any;

    // Check if company is active
    if (company.status === 'suspended') {
      console.error('Company suspended:', companyId);
      return new Response(
        JSON.stringify({ error: 'Empresa suspendida. Contacta con administración.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current active session
    const { data: activeSession } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user.id)
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
      return new Response(
        JSON.stringify({ error: 'Ya tienes una sesión activa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((action === 'out' || action === 'break_start' || action === 'break_end') && !activeSession) {
      return new Response(
        JSON.stringify({ error: 'No tienes ninguna sesión activa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert time event
    const { error: eventError } = await supabase.from('time_events').insert({
      user_id: user.id,
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
      return new Response(
        JSON.stringify({ error: 'Error al registrar evento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create work session
    if (action === 'in') {
      // Create new session
      const { error: sessionError } = await supabase.from('work_sessions').insert({
        user_id: user.id,
        company_id: companyId,
        clock_in_time: new Date().toISOString(),
        is_active: true,
        status: 'open',
      });

      if (sessionError) {
        console.error('Session insert error:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Error al crear sesión' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (action === 'out' && activeSession) {
      // Close session
      const { error: updateError } = await supabase
        .from('work_sessions')
        .update({
          clock_out_time: new Date().toISOString(),
          is_active: false,
          status: 'closed',
        })
        .eq('id', activeSession.id);

      if (updateError) {
        console.error('Session update error:', updateError);
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

    console.log('Clock action completed:', { user_id: user.id, action, status: currentStatus });

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
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
