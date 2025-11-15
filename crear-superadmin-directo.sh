#!/bin/bash

# Script para crear superadmin directamente (con contraseña como argumento)

EMAIL="${1:-gnerai@gneraitiq.com}"
PASSWORD="${2}"
FULL_NAME="${3:-GTiQ Admin}"

if [ -z "$PASSWORD" ]; then
  echo "❌ Uso: ./crear-superadmin-directo.sh [email] [password] [fullName]"
  echo ""
  echo "Ejemplo:"
  echo "  ./crear-superadmin-directo.sh gnerai@gneraitiq.com MiPassword123 'GTiQ Admin'"
  exit 1
fi

PROJECT_REF="TU_PROJECT_REF"
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/admin-create-superadmin"
ANON_KEY="REEMPLAZA_CON_TU_ANON_KEY"

echo "🔐 Creando superadmin..."
echo "📧 Email: ${EMAIL}"
echo "👤 Nombre: ${FULL_NAME}"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON_KEY}" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"fullName\": \"${FULL_NAME}\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Superadmin creado exitosamente!"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""
  echo "🎉 Credenciales:"
  echo "   Email: ${EMAIL}"
  echo "   Password: ${PASSWORD}"
else
  echo "❌ Error al crear superadmin (HTTP ${HTTP_CODE})"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi
