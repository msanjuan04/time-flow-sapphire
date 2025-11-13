#!/bin/bash

# Script para desplegar funciones admin de Supabase
# Si falla por permisos, te dará instrucciones

PROJECT_REF="fyyhkdishlythkdnojdh"

echo "🚀 Desplegando funciones admin..."
echo ""

# Lista de funciones admin a desplegar
FUNCTIONS=(
  "admin-create-invite"
  "admin-list-companies"
  "admin-list-users"
  "admin-create-company"
  "admin-impersonate"
  "admin-stop-impersonate"
  "admin-get-company"
  "admin-set-company-status"
  "admin-transfer-ownership"
  "admin-stats"
  "admin-list-logs"
  "admin-autoclose-sessions"
  "admin-create-superadmin"
)

cd "$(dirname "$0")"

# Intentar desplegar todas las funciones
ERROR_COUNT=0
for func in "${FUNCTIONS[@]}"; do
  echo "📦 Desplegando: $func"
  OUTPUT=$(supabase functions deploy "$func" --project-ref "$PROJECT_REF" 2>&1)
  EXIT_CODE=$?
  echo "$OUTPUT"
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ $func desplegada correctamente"
  else
    echo "❌ Error al desplegar $func"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    
    if echo "$OUTPUT" | grep -q "403\|privileges"; then
      echo ""
      echo "⚠️  ═══════════════════════════════════════════════════════════"
      echo "   ERROR DE PERMISOS DETECTADO"
      echo "   ═══════════════════════════════════════════════════════════"
      echo ""
      echo "   No tienes permisos para desplegar funciones vía CLI."
      echo ""
      echo "📋 SOLUCIONES:"
      echo ""
      echo "1️⃣  Verifica que eres OWNER del proyecto:"
      echo "   👉 https://supabase.com/dashboard/project/$PROJECT_REF/settings/team"
      echo ""
      echo "2️⃣  Si no eres owner, pide al owner que te invite como colaborador"
      echo "   con permisos de 'Administrator' o 'Owner'"
      echo ""
      echo "3️⃣  Alternativa: Despliega manualmente desde el dashboard:"
      echo "   👉 https://supabase.com/dashboard/project/$PROJECT_REF/functions"
      echo ""
      echo "   Para cada función:"
      echo "   - Haz clic en 'Deploy a new function' o 'Edit function'"
      echo "   - Selecciona la carpeta: supabase/functions/$func/"
      echo "   - ⚠️  IMPORTANTE: Asegúrate de incluir la carpeta _shared/"
      echo ""
      echo "   Funciones pendientes:"
      for remaining in "${FUNCTIONS[@]:$ERROR_COUNT}"; do
        echo "   - $remaining"
      done
      echo ""
      echo "⚠️  ═══════════════════════════════════════════════════════════"
      echo ""
      break
    fi
  fi
  echo ""
done

echo "✅ Proceso completado"

