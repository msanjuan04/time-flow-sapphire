#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const TARGET_EMAIL = "gnerai@gneraitiq.com";
const LOGIN_CODE = "739421";
const DEFAULT_NAME = "GTiQ Superadmin";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Debes definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu entorno.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function regenerateConflictingCodes(userId) {
  const { data: conflicts, error } = await admin
    .from("profiles")
    .select("id")
    .eq("login_code", LOGIN_CODE)
    .neq("id", userId);

  if (error) throw error;
  if (!conflicts || conflicts.length === 0) return;

  for (const conflict of conflicts) {
    const { data: newCode, error: codeError } = await admin.rpc("generate_login_code");
    if (codeError || !newCode) {
      throw codeError || new Error("No se pudo generar un nuevo código");
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ login_code: newCode })
      .eq("id", conflict.id);

    if (updateError) throw updateError;
    console.log(`⚠️  Reasignado código a usuario ${conflict.id} -> ${newCode}`);
  }
}

async function ensureSuperadmin() {
  // Primero buscar en profiles por email (más eficiente)
  const { data: profileData, error: profileSearchError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", TARGET_EMAIL)
    .maybeSingle();

  let user = null;

  if (profileData && profileData.id) {
    // Usuario existe, obtener sus datos de auth.users
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profileData.id);
    if (!userError && userData?.user) {
      user = userData.user;
    }
  }

  if (!user) {
    console.log("ℹ️  No existe aún, creando usuario superadmin...");
    const { data, error } = await admin.auth.admin.createUser({
      email: TARGET_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: DEFAULT_NAME },
    });
    if (error || !data?.user) {
      throw error || new Error("No se pudo crear el usuario");
    }
    user = data.user;
  } else {
    console.log("ℹ️  Usuario encontrado, actualizando configuración...");
  }

  const fullName = user.user_metadata?.full_name || DEFAULT_NAME;

  const { error: profileUpsertError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: TARGET_EMAIL,
      full_name: fullName,
      is_active: true,
      is_superadmin: true, // Set is_superadmin flag
    },
    { onConflict: "id" }
  );

  if (profileUpsertError) throw profileUpsertError;

  await regenerateConflictingCodes(user.id);

  // Verificar si ya tiene un código, si no, asignar el predeterminado
  const { data: currentProfile } = await admin
    .from("profiles")
    .select("login_code")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.login_code) {
    const { error: codeError } = await admin
      .from("profiles")
      .update({ login_code: LOGIN_CODE })
      .eq("id", user.id);
    if (codeError) throw codeError;
    console.log(`🔐 Código asignado: ${LOGIN_CODE}`);
  } else {
    console.log(`🔐 Código existente: ${currentProfile.login_code}`);
  }

  const { error: superError } = await admin
    .from("superadmins")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (superError) throw superError;

  console.log(`✅ Superadmin listo: ${TARGET_EMAIL} (ID ${user.id})`);
  
  // Mostrar el código final (ya se mostró antes si se asignó)
  const { data: finalProfile } = await admin
    .from("profiles")
    .select("login_code")
    .eq("id", user.id)
    .single();
  
  if (finalProfile?.login_code) {
    console.log(`🔐 Código de acceso: ${finalProfile.login_code}`);
  }
}

ensureSuperadmin().catch((err) => {
  console.error("❌ Error asegurando superadmin:", err);
  process.exit(1);
});
