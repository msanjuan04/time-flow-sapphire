/**
 * Standard CORS headers for Edge Functions
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Handles OPTIONS requests for CORS preflight
 */
export function handleCorsOptions(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Creates a JSON response with CORS headers
 */
export function createJsonResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Creates an error response with CORS headers
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({ 
      error,
      ...(details && { details })
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
