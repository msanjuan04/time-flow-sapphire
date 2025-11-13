#!/bin/bash

# Script para verificar la conexión del frontend con el nuevo backend Supabase

echo "🔍 Verificando conexión con Supabase..."
echo ""

cd "$(dirname "$0")"

# Verificar que existe .env
if [ ! -f .env ]; then
  echo "❌ No se encontró el archivo .env"
  echo "   Ejecuta: ./create-env.sh o ./update-env.sh"
  exit 1
fi

# Cargar variables de entorno
export $(grep -v '^#' .env | xargs)

# Verificar variables requeridas
echo "📋 Verificando variables de entorno..."
echo ""

MISSING_VARS=0

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ VITE_SUPABASE_URL no está configurada"
  MISSING_VARS=1
else
  echo "✅ VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
fi

if [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "❌ VITE_SUPABASE_PUBLISHABLE_KEY no está configurada"
  MISSING_VARS=1
else
  echo "✅ VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY:0:30}..."
fi

if [ -z "$VITE_SUPABASE_PROJECT_ID" ]; then
  echo "❌ VITE_SUPABASE_PROJECT_ID no está configurada"
  MISSING_VARS=1
else
  echo "✅ VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}"
fi

if [ $MISSING_VARS -eq 1 ]; then
  echo ""
  echo "⚠️  Faltan variables de entorno. Ejecuta: ./update-env.sh"
  exit 1
fi

echo ""
echo "🌐 Verificando conexión con Supabase..."
echo ""

# Verificar que la URL de Supabase responde
SUPABASE_URL="${VITE_SUPABASE_URL}"
if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
  echo "⚠️  La URL de Supabase no tiene el formato correcto"
  echo "   Esperado: https://[project-ref].supabase.co"
  echo "   Actual: ${SUPABASE_URL}"
fi

# Verificar que el proyecto existe (hacer una petición simple)
echo "📡 Probando conexión a ${SUPABASE_URL}..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/rest/v1/" -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "✅ Conexión exitosa (HTTP ${HTTP_CODE})"
else
  echo "⚠️  No se pudo conectar (HTTP ${HTTP_CODE})"
  echo "   Verifica que la URL y la clave sean correctas"
fi

echo ""
echo "🔧 Verificando config.toml..."
if [ -f supabase/config.toml ]; then
  PROJECT_ID_IN_CONFIG=$(grep "project_id" supabase/config.toml | cut -d '"' -f2)
  if [ "$PROJECT_ID_IN_CONFIG" = "$VITE_SUPABASE_PROJECT_ID" ]; then
    echo "✅ config.toml tiene el project_id correcto: ${PROJECT_ID_IN_CONFIG}"
  else
    echo "⚠️  config.toml tiene project_id diferente:"
    echo "   config.toml: ${PROJECT_ID_IN_CONFIG}"
    echo "   .env: ${VITE_SUPABASE_PROJECT_ID}"
  fi
else
  echo "⚠️  No se encontró supabase/config.toml"
fi

echo ""
echo "📦 Verificando Edge Functions desplegadas..."
echo ""
echo "   Puedes verificar manualmente en:"
echo "   https://supabase.com/dashboard/project/${VITE_SUPABASE_PROJECT_ID}/functions"
echo ""

echo "✅ Verificación completada"
echo ""
echo "🚀 Próximos pasos:"
echo "   1. Inicia el servidor de desarrollo: npm run dev"
echo "   2. Abre el navegador en http://localhost:8080"
echo "   3. Prueba iniciar sesión o crear una cuenta"
echo "   4. Verifica que las funciones funcionen correctamente"
echo ""

