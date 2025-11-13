#!/bin/bash

# Script para ejecutar ensure:superadmin con las variables de entorno correctas

PROJECT_REF="fyyhkdishlythkdnojdh"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

echo "🔐 Configurando variables de entorno para ensure:superadmin"
echo ""

# Exportar SUPABASE_URL
export SUPABASE_URL="${SUPABASE_URL}"
echo "✅ SUPABASE_URL=${SUPABASE_URL}"

# El SERVICE_ROLE_KEY debe obtenerse del dashboard de Supabase
# Ve a: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api
# Copia el "service_role" key (secret)

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo ""
  echo "⚠️  SUPABASE_SERVICE_ROLE_KEY no está configurado"
  echo ""
  echo "Para obtener el SERVICE_ROLE_KEY:"
  echo "1. Ve a: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
  echo "2. Busca 'service_role' key (secret)"
  echo "3. Cópialo y ejecuta:"
  echo ""
  echo "   export SUPABASE_SERVICE_ROLE_KEY='tu-service-role-key-aqui'"
  echo "   npm run ensure:superadmin"
  echo ""
  echo "O ejecuta este script con:"
  echo "   SUPABASE_SERVICE_ROLE_KEY='tu-key' ./ejecutar-ensure-superadmin.sh"
  exit 1
fi

export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
echo "✅ SUPABASE_SERVICE_ROLE_KEY configurado"

echo ""
echo "🚀 Ejecutando ensure:superadmin..."
echo ""

npm run ensure:superadmin

