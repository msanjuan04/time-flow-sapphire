#!/bin/bash
# Script para actualizar el archivo .env con los valores correctos del proyecto gtiq

echo "🔄 Actualizando archivo .env con los valores correctos del proyecto gtiq..."

# Valores correctos del proyecto gtiq
PROJECT_ID="fyyhkdishlythkdnojdh"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"

# Leer el anon key actual si existe
if [ -f .env ]; then
  CURRENT_ANON_KEY=$(grep "VITE_SUPABASE_PUBLISHABLE_KEY" .env | cut -d '=' -f2 | tr -d ' ')
  if [ -n "$CURRENT_ANON_KEY" ] && [ "$CURRENT_ANON_KEY" != "REEMPLAZA_CON_TU_ANON_KEY" ] && [ "$CURRENT_ANON_KEY" != "TU_ANON_KEY_AQUI" ]; then
    echo "✅ Manteniendo tu anon key actual: ${CURRENT_ANON_KEY:0:20}..."
    ANON_KEY="$CURRENT_ANON_KEY"
  else
    echo "⚠️  No se encontró un anon key válido en .env"
    echo "   Por favor, obtén tu anon key desde:"
    echo "   https://supabase.com/dashboard/project/${PROJECT_ID}/settings/api"
    read -p "   Pega tu anon key aquí: " ANON_KEY
  fi
else
  echo "⚠️  Archivo .env no encontrado. Se creará uno nuevo."
  echo "   Por favor, obtén tu anon key desde:"
  echo "   https://supabase.com/dashboard/project/${PROJECT_ID}/settings/api"
  read -p "   Pega tu anon key aquí: " ANON_KEY
fi

# Leer el Mapbox token actual si existe
if [ -f .env ]; then
  CURRENT_MAPBOX_TOKEN=$(grep "VITE_MAPBOX_PUBLIC_TOKEN" .env | cut -d '=' -f2 | tr -d ' ')
  if [ -n "$CURRENT_MAPBOX_TOKEN" ] && [ "$CURRENT_MAPBOX_TOKEN" != "REEMPLAZA_CON_TU_MAPBOX_PUBLIC_TOKEN" ]; then
    echo "✅ Manteniendo tu Mapbox token actual: ${CURRENT_MAPBOX_TOKEN:0:20}..."
    MAPBOX_TOKEN="$CURRENT_MAPBOX_TOKEN"
  else
    MAPBOX_TOKEN="REEMPLAZA_CON_TU_MAPBOX_PUBLIC_TOKEN"
  fi
else
  MAPBOX_TOKEN="REEMPLAZA_CON_TU_MAPBOX_PUBLIC_TOKEN"
fi

# Crear/actualizar el archivo .env
cat > .env << EOF
# Supabase Configuration
# Project: gtiq (${PROJECT_ID})
# Actualizado: $(date)
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=${PROJECT_ID}

# Mapbox Configuration
# Obtén tu token público en: https://account.mapbox.com/access-tokens/
# El token debe tener permisos para usar Mapbox GL JS
VITE_MAPBOX_PUBLIC_TOKEN=${MAPBOX_TOKEN}
EOF

echo ""
echo "✅ Archivo .env actualizado correctamente!"
echo ""
echo "📋 Valores configurados:"
echo "   VITE_SUPABASE_URL=${SUPABASE_URL}"
echo "   VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY:0:30}..."
echo "   VITE_SUPABASE_PROJECT_ID=${PROJECT_ID}"
echo "   VITE_MAPBOX_PUBLIC_TOKEN=${MAPBOX_TOKEN:0:30}..."
echo ""
if [ "$MAPBOX_TOKEN" = "REEMPLAZA_CON_TU_MAPBOX_PUBLIC_TOKEN" ]; then
  echo "⚠️  IMPORTANTE: Configura VITE_MAPBOX_PUBLIC_TOKEN en .env"
  echo "   Obtén tu token en: https://account.mapbox.com/access-tokens/"
fi
echo ""
echo "🔍 Verifica el contenido con: cat .env"

