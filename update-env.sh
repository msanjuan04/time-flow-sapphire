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

# Crear/actualizar el archivo .env
cat > .env << EOF
# Supabase Configuration
# Project: gtiq (${PROJECT_ID})
# Actualizado: $(date)
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=${PROJECT_ID}
EOF

echo ""
echo "✅ Archivo .env actualizado correctamente!"
echo ""
echo "📋 Valores configurados:"
echo "   VITE_SUPABASE_URL=${SUPABASE_URL}"
echo "   VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY:0:30}..."
echo "   VITE_SUPABASE_PROJECT_ID=${PROJECT_ID}"
echo ""
echo "🔍 Verifica el contenido con: cat .env"

