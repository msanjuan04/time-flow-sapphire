import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

interface SignRequest {
  company_id: string;
  scope?: 'company' | 'user';
  user_id?: string;
  report_type?: string;
  period_start: string; // ISO date
  period_end: string;   // ISO date
  payload: any;         // datos crudos del informe (jornadas, totales, etc.)
  notes?: string;
}

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

async function sha256(data: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return toHex(buf);
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return toHex(sig);
}

/** Canonicaliza JSON para que el hash sea determinista (claves ordenadas). */
function canonicalize(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') +
    '}'
  );
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SIGNING_KEY = Deno.env.get('REPORT_SIGNING_KEY');

    if (!SIGNING_KEY) {
      return new Response(
        JSON.stringify({ error: 'REPORT_SIGNING_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: SignRequest = await req.json();

    if (!body.company_id || !body.period_start || !body.period_end || !body.payload) {
      return new Response(JSON.stringify({ error: 'missing_required_fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify membership and role
    const { data: membership } = await userClient
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', body.company_id)
      .maybeSingle();

    if (!membership || !['owner', 'admin', 'manager'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const generatedAt = new Date().toISOString();
    const verificationToken = randomToken();

    // Build canonical document used for hashing
    const canonicalDoc = {
      company_id: body.company_id,
      report_type: body.report_type || 'jornadas',
      scope: body.scope || 'company',
      user_id: body.user_id || null,
      period_start: body.period_start,
      period_end: body.period_end,
      generated_at: generatedAt,
      generated_by: user.id,
      payload: body.payload,
    };

    const canonicalString = canonicalize(canonicalDoc);
    const contentHash = await sha256(canonicalString);
    const signature = await hmacSha256(SIGNING_KEY, contentHash + '|' + verificationToken);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: inserted, error: insertErr } = await adminClient
      .from('signed_reports')
      .insert({
        company_id: body.company_id,
        generated_by: user.id,
        generated_by_email: user.email,
        generated_at: generatedAt,
        report_type: body.report_type || 'jornadas',
        scope: body.scope || 'company',
        user_id: body.user_id ?? null,
        period_start: body.period_start,
        period_end: body.period_end,
        payload: body.payload,
        content_hash: contentHash,
        signature,
        verification_token: verificationToken,
        notes: body.notes ?? null,
      })
      .select('id, generated_at, verification_token, content_hash, signature')
      .single();

    if (insertErr) {
      console.error('Insert signed_report error:', insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        id: inserted.id,
        generated_at: inserted.generated_at,
        verification_token: inserted.verification_token,
        content_hash: inserted.content_hash,
        signature: inserted.signature,
        signed_by_email: user.email,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('sign-report error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
