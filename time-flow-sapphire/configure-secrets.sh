#!/bin/bash
# Script para configurar los secrets de las Edge Functions

PROJECT_REF="fyyhkdishlythkdnojdh"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

echo "🔐 Configuración de Secrets para Edge Functions"
echo "================================================"
echo ""
echo "📋 Project: gtiq (${PROJECT_REF})"
echo ""

# Obtener anon key del .env si existe
if [ -f .env ]; then
  ANON_KEY=$(grep "VITE_SUPABASE_PUBLISHABLE_KEY" .env | cut -d '=' -f2 | tr -d ' ' | tr -d '"')
  if [ -n "$ANON_KEY" ]; then
    echo "✅ Anon key encontrado en .env"
  else
    echo "⚠️  Anon key no encontrado en .env"
    read -p "Pega tu anon key: " ANON_KEY
  fi
else
  echo "⚠️  Archivo .env no encontrado"
  read -p "Pega tu anon key: " ANON_KEY
fi

echo ""
echo "ℹ️  NOTA: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY"
echo "   se inyectan automáticamente por Supabase en las Edge Functions."
echo "   Solo necesitas configurar los secrets personalizados (emails)."
echo ""

# Resend API Key (opcional)
echo ""
read -p "¿Tienes RESEND_API_KEY para enviar emails? (s/n): " tiene_resend
if [ "$tiene_resend" = "s" ] || [ "$tiene_resend" = "S" ]; then
  read -sp "Pega tu RESEND_API_KEY: " RESEND_API_KEY
  echo ""
  read -p "Email FROM (ej: GTiQ <no-reply@tudominio.com>): " EMAIL_FROM
  echo ""
  echo "🌐 SITE_URL:"
  echo "   - Para desarrollo local: http://localhost:8080"
  echo "   - Para producción: https://app.tudominio.com"
  read -p "   ¿Qué URL quieres usar? [localhost:8080]: " SITE_URL
  SITE_URL=${SITE_URL:-http://localhost:8080}
  echo "   ✅ Usando: ${SITE_URL}"
  echo "   💡 Puedes cambiarla más tarde cuando publiques"
else
  RESEND_API_KEY=""
  EMAIL_FROM="GTiQ <no-reply@gtiq.local>"
  SITE_URL="http://localhost:8080"
  echo "⚠️  RESEND_API_KEY no configurado. Los emails no funcionarán hasta configurarlo."
  echo "   💡 Por ahora SITE_URL se configuró como: ${SITE_URL}"
fi

echo ""
echo "ℹ️  NOTA: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY"
echo "   se inyectan automáticamente por Supabase, no necesitas configurarlos."
echo ""
echo "🔄 Configurando secrets personalizados en Supabase..."

# Configurar Resend si se proporcionó
if [ -n "$RESEND_API_KEY" ]; then
  echo "📧 Configurando secrets de email..."
  supabase secrets set \
    --project-ref ${PROJECT_REF} \
    RESEND_API_KEY="${RESEND_API_KEY}" \
    EMAIL_FROM="${EMAIL_FROM}" \
    SITE_URL="${SITE_URL}"
  
  if [ $? -eq 0 ]; then
    echo "✅ Secrets de email configurados correctamente"
  else
    echo "⚠️  Error al configurar secrets de email"
    echo "   Intenta configurarlos manualmente desde el dashboard:"
    echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions"
  fi
else
  echo "⚠️  RESEND_API_KEY no configurado."
  echo "   Los emails no funcionarán hasta configurarlo."
  echo "   Puedes configurarlo más tarde desde el dashboard:"
  echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions"
fi

echo ""
echo "✅ Configuración completada!"
echo ""
echo "📋 Resumen:"
echo "   ✅ SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
echo "      se inyectan automáticamente por Supabase"
if [ -n "$RESEND_API_KEY" ]; then
  echo "   ✅ RESEND_API_KEY=${RESEND_API_KEY:0:20}..."
  echo "   ✅ EMAIL_FROM=${EMAIL_FROM}"
  echo "   ✅ SITE_URL=${SITE_URL}"
else
  echo "   ⚠️  RESEND_API_KEY no configurado (emails no funcionarán)"
fi
echo ""
echo "🚀 Ahora puedes desplegar las Edge Functions con:"
echo "   supabase functions deploy --project-ref ${PROJECT_REF}"

