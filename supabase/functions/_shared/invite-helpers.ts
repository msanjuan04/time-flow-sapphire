import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const randomPassword = () => crypto.randomUUID().replace(/-/g, "");

export interface EnsureProfileOptions {
  email: string;
  centerId?: string | null;
  teamId?: string | null;
}

export interface EnsureProfileResult {
  profileId: string;
  loginCode: string;
  userExisted: boolean;
}

export const ensureWorkerProfile = async (
  supabaseAdmin: SupabaseClient,
  { email, centerId, teamId }: EnsureProfileOptions
): Promise<EnsureProfileResult> => {
  const normalizedEmail = email.toLowerCase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, login_code, full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  let profileId = profile?.id ?? null;
  let loginCode = profile?.login_code ?? null;
  const userExisted = Boolean(profileId);

  if (!profileId) {
    const defaultName = normalizedEmail.split("@")[0];
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      password: randomPassword(),
      user_metadata: { full_name: defaultName },
    });

    if (createError || !newUser?.user) {
      console.error("Error creating auth user for invite:", createError);
      throw new Error("No pudimos preparar el usuario invitado");
    }

    profileId = newUser.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: profileId,
          email: normalizedEmail,
          full_name: newUser.user.user_metadata?.full_name || defaultName,
        },
        { onConflict: "id" }
      );
  }

  if (!loginCode) {
    const { data: newCode, error: codeError } = await supabaseAdmin.rpc("generate_login_code");
    if (codeError || !newCode) {
      console.error("Failed to generate login code:", codeError);
      throw new Error("No pudimos generar el código de acceso");
    }

    loginCode = newCode;
    await supabaseAdmin
      .from("profiles")
      .update({ login_code: newCode })
      .eq("id", profileId);
  }

  const updates: Record<string, unknown> = {};
  if (centerId) updates.center_id = centerId;
  if (teamId) updates.team_id = teamId;
  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from("profiles").update(updates).eq("id", profileId);
  }

  return { profileId: profileId!, loginCode, userExisted };
};
