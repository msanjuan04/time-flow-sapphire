/**
 * Standard CORS headers for Edge Functions
 */ export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
/**
 * Handles OPTIONS requests for CORS preflight
 */ export function handleCorsOptions() {
  return new Response(null, {
    headers: corsHeaders
  });
}
/**
 * Creates a JSON response with CORS headers
 */ export function createJsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
/**
 * Creates an error response with CORS headers
 */ export function createErrorResponse(error, status = 500, details) {
  const body = {
    error
  };
  if (details) {
    body.details = details;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
