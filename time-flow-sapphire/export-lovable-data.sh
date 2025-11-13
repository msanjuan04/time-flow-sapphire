#!/bin/bash
# Script para exportar datos desde Lovable Cloud

echo "📦 Exportación de datos desde Lovable Cloud"
echo "=========================================="
echo ""

# Project ref de Lovable Cloud (el anterior)
LOVABLE_PROJECT_REF="zsjmkxbiywswjopihqwc"
LOVABLE_DB_URL="postgresql://postgres:[YOUR-PASSWORD]@db.${LOVABLE_PROJECT_REF}.supabase.co:5432/postgres"

echo "🔍 Para exportar los datos necesitas:"
echo ""
echo "1. La URL de conexión de la base de datos de Lovable Cloud"
echo "   Puedes obtenerla desde:"
echo "   https://supabase.com/dashboard/project/${LOVABLE_PROJECT_REF}/settings/database"
echo ""
echo "   O desde Lovable Cloud:"
echo "   - Ve a tu proyecto en Lovable"
echo "   - Settings → Database"
echo "   - Busca 'Connection string' o 'Connection pooling'"
echo ""
echo "2. El formato debería ser:"
echo "   postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
echo ""
echo "3. Una vez tengas la URL, ejecuta estos comandos:"
echo ""
echo "   # Exportar datos de tablas (sin auth.users)"
echo "   pg_dump \"\$LOVABLE_DB_URL\" \\"
echo "     --data-only \\"
echo "     --column-inserts \\"
echo "     --no-owner \\"
echo "     --no-privileges \\"
echo "     --table=profiles \\"
echo "     --table=companies \\"
echo "     --table=memberships \\"
echo "     --table=centers \\"
echo "     --table=teams \\"
echo "     --table=invites \\"
echo "     --table=devices \\"
echo "     --table=device_tokens \\"
echo "     --table=time_events \\"
echo "     --table=work_sessions \\"
echo "     --table=absences \\"
echo "     --table=scheduled_hours \\"
echo "     --table=incidents \\"
echo "     --table=correction_requests \\"
echo "     --table=notifications \\"
echo "     --table=alerts \\"
echo "     --table=audit_logs \\"
echo "     --table=superadmins \\"
echo "     > lovable-data.sql"
echo ""
echo "   # Exportar usuarios de auth (requiere Supabase CLI)"
echo "   supabase auth export --project-id ${LOVABLE_PROJECT_REF} --format=json --password gtiqgnerai123 > auth-export.json"
echo ""
echo "=========================================="
echo ""
read -p "¿Tienes la URL de conexión de Lovable Cloud? (s/n): " tiene_url

if [ "$tiene_url" = "s" ] || [ "$tiene_url" = "S" ]; then
  read -p "Pega la URL de conexión aquí: " LOVABLE_DB_URL
  echo ""
  echo "🔄 Exportando datos..."
  
  # Exportar datos de tablas
  echo "📊 Exportando datos de tablas..."
  pg_dump "$LOVABLE_DB_URL" \
    --data-only \
    --column-inserts \
    --no-owner \
    --no-privileges \
    --table=profiles \
    --table=companies \
    --table=memberships \
    --table=centers \
    --table=teams \
    --table=invites \
    --table=devices \
    --table=device_tokens \
    --table=time_events \
    --table=work_sessions \
    --table=absences \
    --table=scheduled_hours \
    --table=incidents \
    --table=correction_requests \
    --table=notifications \
    --table=alerts \
    --table=audit_logs \
    --table=superadmins \
    > lovable-data.sql 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✅ Datos exportados a lovable-data.sql"
  else
    echo "❌ Error al exportar datos. Verifica la URL y las credenciales."
    exit 1
  fi
  
  echo ""
  echo "👥 Para exportar usuarios de auth, ejecuta:"
  echo "   supabase auth export --project-id ${LOVABLE_PROJECT_REF} --format=json --password [TU_PASSWORD] > auth-export.json"
else
  echo ""
  echo "📝 Pasos para obtener la URL:"
  echo "   1. Ve a: https://supabase.com/dashboard/project/${LOVABLE_PROJECT_REF}/settings/database"
  echo "   2. En 'Connection string', copia la URL"
  echo "   3. Reemplaza [] con tu contraseña de la base de datos"
  echo "   4. Ejecuta este script de nuevo"
fi

