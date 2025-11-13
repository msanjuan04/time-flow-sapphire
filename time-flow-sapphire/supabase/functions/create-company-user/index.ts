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
    const { email, password, fullName, company_id, role } = await req.json();

    if (!email || !password || !company_id || !role) {
      return new Response(
        JSON.stringify({ error: "email, password, company_id and role are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['owner', 'admin', 'manager', 'worker'].includes(role)) {
      return new Response(
        JSON.stringify({ error: "role must be: owner, admin, manager, or worker" }),
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

    // Verify company exists
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create membership
    const { error: membershipError } = await supabaseAdmin
      .from('memberships')
      .insert({
        user_id: userData.user.id,
        company_id: company_id,
        role: role
      });

    if (membershipError) {
      console.error("Error creating membership:", membershipError);
      return new Response(
        JSON.stringify({ error: "User created but failed to create membership" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If role is owner, update company owner_user_id
    if (role === 'owner') {
      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({ owner_user_id: userData.user.id })
        .eq('id', company_id);

      if (updateError) {
        console.error("Error updating company owner:", updateError);
      }
    }

    console.log(`User created: ${email} with role ${role} in company ${company_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User created successfully",
        user_id: userData.user.id,
        company_id: company_id,
        role: role
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

