#!/bin/bash

# Script para crear el superadmin gnerai@gneraitiq.com
# Ejecuta: ./crear-superadmin-gnerai.sh

EMAIL="gnerai@gneraitiq.com"
PROJECT_REF="TU_PROJECT_REF"
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/admin-create-superadmin"
ANON_KEY="REEMPLAZA_CON_TU_ANON_KEY"

echo "🔐 Creando superadmin: ${EMAIL}"
echo ""
echo "⚠️  Necesitas proporcionar una contraseña"
echo ""

read -sp "🔑 Contraseña: " PASSWORD
echo ""

if [ -z "$PASSWORD" ]; then
  echo "❌ La contraseña no puede estar vacía"
  exit 1
fi

read -p "👤 Nombre completo [GTiQ Admin]: " FULL_NAME
FULL_NAME=${FULL_NAME:-"GTiQ Admin"}

echo ""
echo "🔄 Creando superadmin..."

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

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Superadmin creado exitosamente!"
  echo ""
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""
  echo "🎉 Credenciales:"
  echo "   Email: ${EMAIL}"
  echo "   Password: [la que ingresaste]"
  echo ""
  echo "🚀 Ahora puedes iniciar sesión en http://localhost:8080"
else
  echo "❌ Error al crear superadmin (HTTP ${HTTP_CODE})"
  echo ""
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi
