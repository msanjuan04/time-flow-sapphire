import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function normalizeCardUid(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ success: true }, 200);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body: { card_uid?: string; point_id?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'invalid_body', message: 'El cuerpo no es JSON válido' }, 400);
    }

    const rawCardUid = (body.card_uid ?? '').trim();
    const rawPointId = (body.point_id ?? '').trim();

    if (!rawCardUid) {
      return jsonResponse({ error: 'missing_card_uid', message: 'card_uid es obligatorio' }, 400);
    }
    if (!rawPointId || !isUuid(rawPointId)) {
      return jsonResponse({ error: 'invalid_point_id', message: 'point_id inválido o ausente' }, 400);
    }

    const normalizedUid = normalizeCardUid(rawCardUid);
    if (!normalizedUid) {
      return jsonResponse({ error: 'invalid_card_uid', message: 'UID vacío tras normalizar' }, 400);
    }

    // Obtener punto de fichaje
    const { data: point, error: pointError } = await supabaseAdmin
      .from('fastclock_points')
      .select('id, company_id, name, active')
      .eq('id', rawPointId)
      .maybeSingle();

    if (pointError) return jsonResponse({ error: 'point_fetch_error' }, 500);
    if (!point)     return jsonResponse({ error: 'point_not_found', message: 'Punto no existe' }, 404);
    if (!point.active) return jsonResponse({ error: 'point_inactive', message: 'Punto desactivado' }, 400);

    const companyId: string = point.company_id;

    // Comprobar empresa
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('status, name')
      .eq('id', companyId)
      .maybeSingle();

    if (!company) return jsonResponse({ error: 'company_not_found' }, 404);
    if (company.status === 'suspended') {
      return jsonResponse({ error: 'company_suspended', message: 'Empresa suspendida' }, 403);
    }

    // Buscar tarjeta NFC
    const { data: nfcCard, error: cardError } = await supabaseAdmin
      .from('nfc_cards')
      .select('id, user_id, label, active')
      .eq('company_id', companyId)
      .eq('card_uid_normalized', normalizedUid)
      .maybeSingle();

    if (cardError) return jsonResponse({ error: 'card_fetch_error' }, 500);
    if (!nfcCard) {
      return jsonResponse({
        error: 'card_not_registered',
        message: 'Tarjeta no registrada en esta empresa. Pide que la den de alta.',
      }, 404);
    }
    if (!nfcCard.active) {
      return jsonResponse({
        error: 'card_inactive',
        message: 'Tarjeta desactivada. Contacta con tu empresa.',
      }, 400);
    }

    const userId: string = nfcCard.user_id;

    // Nombre del empleado
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    const employeeName = profile?.full_name?.trim() || profile?.email || 'Empleado';

    // Determinar entrada o salida
    const { data: activeSession } = await supabaseAdmin
      .from('work_sessions')
      .select('id, clock_in_time')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();

    const action: 'in' | 'out' = activeSession ? 'out' : 'in';
    const now = new Date();

    // Insertar time_event — usamos 'fastclock' que ya está permitido en el constraint
    const { error: eventError } = await supabaseAdmin
      .from('time_events')
      .insert({
        user_id:    userId,
        company_id: companyId,
        event_type: action === 'in' ? 'clock_in' : 'clock_out',
        event_time: now.toISOString(),
        source:     'fastclock',
        point_id:   rawPointId,
        device_id:  `nfc:${normalizedUid}`,
      });

    if (eventError) {
      console.error('Error insertando time_event:', eventError);
      return jsonResponse({ error: 'event_insert_failed', message: 'Error al registrar el fichaje' }, 500);
    }

    // Crear o cerrar work_session
    if (action === 'in') {
      await supabaseAdmin.from('work_sessions').insert({
        user_id:       userId,
        company_id:    companyId,
        clock_in_time: now.toISOString(),
        is_active:     true,
        status:        'open',
      });
    } else if (activeSession) {
      const durationSec = Math.max(
        0,
        Math.floor((now.getTime() - new Date(activeSession.clock_in_time).getTime()) / 1000)
      );
      await supabaseAdmin
        .from('work_sessions')
        .update({
          clock_out_time:      now.toISOString(),
          is_active:           false,
          status:              'closed',
          total_work_duration: durationSec,
          updated_at:          now.toISOString(),
        })
        .eq('id', activeSession.id);
    }

    return jsonResponse({
      success:       true,
      action,
      employee_name: employeeName,
      timestamp:     now.toISOString(),
      company_name:  company.name,
    });

  } catch (err) {
    console.error('nfc-clock error:', err);
    return jsonResponse({ error: 'internal_error', message: 'Error interno' }, 500);
  }
});