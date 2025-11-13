import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

    if (!code || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "Código inválido. Debe ser de 6 dígitos." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
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

    // Buscar usuario por login_code
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, login_code, is_active')
      .eq('login_code', code)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Código incorrecto o usuario no encontrado" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el perfil está activo
    if (!profile.is_active) {
      return new Response(
        JSON.stringify({ error: "Usuario inactivo. Contacta con tu administrador." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el usuario de auth.users
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado en el sistema de autenticación" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar generateLink con recovery y verificar inmediatamente
    // Este es el método más confiable
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: user.user.email,
        options: {
          redirectTo: 'http://localhost:8080/auth/callback',
        },
      });

      if (linkError) {
        console.error("Error generating recovery link:", linkError);
        return new Response(
          JSON.stringify({ error: "Error al generar sesión: " + (linkError.message || "Unknown error") }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!linkData) {
        return new Response(
          JSON.stringify({ error: "No se pudo generar el link de recuperación" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extraer el token de verificación
      const verificationToken = linkData.properties?.verification_token || 
                                linkData.properties?.hashed_token ||
                                null;

      if (!verificationToken) {
        console.error("No se pudo extraer el token. LinkData:", JSON.stringify(linkData, null, 2));
        return new Response(
          JSON.stringify({ error: "No se pudo extraer el token de verificación" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar inmediatamente con el cliente admin
      // Esto debería funcionar porque estamos usando Service Role Key
      const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
        token: verificationToken,
        type: 'recovery',
        email: user.user.email,
      });

      if (verifyError) {
        console.error("Error verifying OTP:", verifyError);
        return new Response(
          JSON.stringify({ error: "Error al verificar token: " + (verifyError.message || "Unknown error") }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!sessionData?.session) {
        return new Response(
          JSON.stringify({ error: "No se pudo crear la sesión después de verificar el token" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retornar los tokens de sesión
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.user.id,
            email: user.user.email,
          },
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in: sessionData.session.expires_in || 3600,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error("Unexpected error in login flow:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return new Response(
        JSON.stringify({ error: "Error inesperado: " + errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
