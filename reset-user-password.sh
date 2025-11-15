#!/bin/bash

# Script para resetear la contraseña de un usuario usando la API de Supabase Admin

PROJECT_REF="TU_PROJECT_REF"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
ANON_KEY="${SUPABASE_ANON_KEY:-REEMPLAZA_CON_TU_ANON_KEY}"

echo "🔐 Reseteo de contraseña de usuario"
echo ""
echo "⚠️  NOTA: Este script requiere el SERVICE_ROLE_KEY de Supabase"
echo "Para resetear contraseñas, usa el dashboard de Supabase:"
echo ""
echo "1. Ve a: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users"
echo "2. Busca el usuario por email"
echo "3. Haz clic en el usuario"
echo "4. En 'Password', haz clic en 'Reset Password' o edita manualmente"
echo ""
echo "O usa la función Edge Function 'create-company-user' para recrear el usuario"
echo "con la contraseña correcta."
