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
    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
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

    // Create the user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split('@')[0]
      }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update profile with is_superadmin = true
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userData.user.id,
        email: userData.user.email,
        full_name: userData.user.user_metadata?.full_name || fullName || email.split('@')[0],
        is_superadmin: true, // Set is_superadmin flag
        is_active: true,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error("Error creating/updating profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User created but failed to create profile" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add user to superadmins table (for backward compatibility)
    const { error: superadminError } = await supabaseAdmin
      .from('superadmins')
      .insert({ user_id: userData.user.id });

    if (superadminError) {
      console.error("Error adding to superadmins:", superadminError);
      // Don't fail if superadmins insert fails, is_superadmin flag is already set
      console.warn("Warning: Could not add to superadmins table, but is_superadmin flag is set");
    }

    console.log(`Superadmin created: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Superadmin account created successfully",
        user_id: userData.user.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
