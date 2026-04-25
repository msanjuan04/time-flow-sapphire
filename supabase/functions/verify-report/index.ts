import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SIGNING_KEY = Deno.env.get('REPORT_SIGNING_KEY');

    if (!SIGNING_KEY) {
      return new Response(
        JSON.stringify({ valid: false, error: 'signing_key_not_configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let token: string | null = null;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    } else if (req.method === 'POST') {
      const body = await req.json();
      token = body?.token || null;
    } else {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'missing_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: report, error } = await adminClient
      .from('signed_reports')
      .select(`
        id,
        company_id,
        generated_by_email,
        generated_at,
        report_type,
        scope,
        user_id,
        period_start,
        period_end,
        payload,
        content_hash,
        signature,
        verification_token,
        companies(name, legal_name, tax_id)
      `)
      .eq('verification_token', token)
      .maybeSingle();

    if (error || !report) {
      return new Response(
        JSON.stringify({ valid: false, error: 'not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Recompute hash and signature
    const canonicalDoc = {
      company_id: report.company_id,
      report_type: report.report_type,
      scope: report.scope,
      user_id: report.user_id || null,
      period_start: report.period_start,
      period_end: report.period_end,
      generated_at: report.generated_at,
      generated_by: null, // not exposed in canonical for verification
      payload: report.payload,
    };
    // The original canonical includes generated_by user id; we stored it in DB but
    // for public verification we don't expose it. To keep verification deterministic,
    // we recompute including generated_by (from the row) — fetch it:
    const { data: ownerRow } = await adminClient
      .from('signed_reports')
      .select('generated_by')
      .eq('id', report.id)
      .single();
    canonicalDoc.generated_by = ownerRow?.generated_by ?? null;

    const recomputedHash = await sha256(canonicalize(canonicalDoc));
    const recomputedSignature = await hmacSha256(
      SIGNING_KEY,
      recomputedHash + '|' + report.verification_token
    );

    const valid =
      recomputedHash === report.content_hash && recomputedSignature === report.signature;

    return new Response(
      JSON.stringify({
        valid,
        id: report.id,
        company_name: (report as any).companies?.legal_name || (report as any).companies?.name,
        company_tax_id: (report as any).companies?.tax_id,
        generated_by_email: report.generated_by_email,
        generated_at: report.generated_at,
        report_type: report.report_type,
        scope: report.scope,
        period_start: report.period_start,
        period_end: report.period_end,
        content_hash: report.content_hash,
        signature: report.signature,
        payload: report.payload,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('verify-report error:', err);
    return new Response(
      JSON.stringify({ valid: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
