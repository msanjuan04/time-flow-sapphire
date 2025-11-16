#!/bin/bash
# Script para desplegar todas las Edge Functions

PROJECT_REF="fyyhkdishlythkdnojdh"

echo "🚀 Desplegando Edge Functions"
echo "=============================="
echo ""
echo "📋 Project: gtiq (${PROJECT_REF})"
echo ""

# Lista de funciones a desplegar
FUNCTIONS=(
  "clock"
  "create-invite"
  "accept-invite"
  "resend-invite"
  "revoke-invite"
  "list-invites"
  "list-people"
  "update-person"
  "delete-person"
  "reactivate-person"
  "notify-correction-request"
  "admin-autoclose-sessions"
  "admin-create-company"
  "admin-create-invite"
  "admin-create-superadmin"
  "admin-example"
  "admin-get-company"
  "admin-impersonate"
  "admin-list-companies"
  "admin-list-logs"
  "admin-list-users"
  "admin-set-company-status"
  "admin-set-company-plan"
  "admin-stats"
  "admin-stop-impersonate"
  "admin-transfer-ownership"
)

echo "📦 Funciones a desplegar: ${#FUNCTIONS[@]}"
echo ""

# Verificar si supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI no está instalado"
  echo "   Instálalo con: npm install -g supabase"
  exit 1
fi

# Desplegar todas las funciones
SUCCESS=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
  echo "🔄 Desplegando: ${func}..."
  supabase functions deploy "${func}" --project-ref "${PROJECT_REF}"
  
  if [ $? -eq 0 ]; then
    echo "✅ ${func} desplegada correctamente"
    ((SUCCESS++))
  else
    echo "❌ Error al desplegar ${func}"
    ((FAILED++))
  fi
  echo ""
done

echo "=============================="
echo "📊 Resumen:"
echo "   ✅ Desplegadas: ${SUCCESS}"
echo "   ❌ Fallidas: ${FAILED}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ¡Todas las funciones desplegadas correctamente!"
  echo ""
  echo "✅ Migración completada!"
  echo ""
  echo "🚀 Próximos pasos:"
  echo "   1. Ejecuta: npm run dev"
  echo "   2. Prueba el sistema en http://localhost:8080"
  echo "   3. Registra un usuario y crea una empresa"
else
  echo "⚠️  Algunas funciones fallaron. Revisa los errores arriba."
fi
