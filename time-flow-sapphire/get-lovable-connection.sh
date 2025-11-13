#!/bin/bash
# Script para obtener/construir la URL de conexión de Lovable Cloud

LOVABLE_PROJECT_REF="zsjmkxbiywswjopihqwc"

echo "🔗 URL de Conexión de Lovable Cloud"
echo "===================================="
echo ""
echo "📋 Project Reference: ${LOVABLE_PROJECT_REF}"
echo ""
echo "🔑 Formato de la URL de conexión:"
echo "   postgresql://postgres:[PASSWORD]@db.${LOVABLE_PROJECT_REF}.supabase.co:5432/postgres"
echo ""
echo "📝 Para obtener la contraseña de la base de datos:"
echo ""
echo "   Opción 1: Desde Lovable Cloud"
echo "   - Ve a tu proyecto en Lovable"
echo "   - Settings → Database o Supabase"
echo "   - Busca 'Database Password' o 'Connection String'"
echo ""
echo "   Opción 2: Desde Supabase (si tienes acceso)"
echo "   - Ve a: https://supabase.com/dashboard/project/${LOVABLE_PROJECT_REF}/settings/database"
echo "   - En 'Connection string' o 'Database password'"
echo "   - Copia la contraseña"
echo ""
echo "   Opción 3: Contactar a Lovable Support"
echo "   - Si no tienes acceso, contacta al soporte de Lovable"
echo "   - Pídeles la contraseña de la base de datos o la connection string completa"
echo ""
echo "🔧 Una vez tengas la contraseña, la URL completa será:"
echo "   postgresql://postgres:[TU_CONTRASEÑA]@db.${LOVABLE_PROJECT_REF}.supabase.co:5432/postgres"
echo ""
echo "⚠️  IMPORTANTE: Reemplaza [TU_CONTRASEÑA] con la contraseña real"
echo ""

read -p "¿Tienes la contraseña de la base de datos? (s/n): " tiene_password

if [ "$tiene_password" = "s" ] || [ "$tiene_password" = "S" ]; then
  read -sp "Pega la contraseña aquí (no se mostrará): " DB_PASSWORD
  echo ""
  echo ""
  LOVABLE_DB_URL="postgresql://postgres:${DB_PASSWORD}@db.${LOVABLE_PROJECT_REF}.supabase.co:5432/postgres"
  echo "✅ URL de conexión construida:"
  echo "   ${LOVABLE_DB_URL}"
  echo ""
  echo "💾 Guardando en variable de entorno..."
  export LOVABLE_DB_URL
  echo "export LOVABLE_DB_URL=\"${LOVABLE_DB_URL}\"" > .lovable-env
  echo "✅ URL guardada en .lovable-env"
  echo ""
  echo "📦 Ahora puedes usar esta URL para exportar los datos:"
  echo "   source .lovable-env"
  echo "   ./export-lovable-data.sh"
else
  echo ""
  echo "📞 Necesitas obtener la contraseña primero:"
  echo "   1. Contacta al soporte de Lovable Cloud"
  echo "   2. O busca en la configuración de tu proyecto en Lovable"
  echo "   3. O intenta acceder a Supabase si Lovable te dio acceso"
fi

