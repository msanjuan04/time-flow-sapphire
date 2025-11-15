#!/bin/bash

# Script para crear usuarios y asociarlos a empresa usando la función create-company-user
# Necesita autenticación como superadmin

COMPANY_ID="d7babcd0-2d90-4300-a4b7-4d394351be6c"
PROJECT_REF="TU_PROJECT_REF"
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/create-company-user"
ANON_KEY="REEMPLAZA_CON_TU_ANON_KEY"

echo "🔐 Creando usuarios para Gnerai Systems S.L..."
echo ""

# Primero necesitamos autenticarnos como superadmin
echo "🔑 Autenticando como superadmin..."
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gnerai@gneraitiq.com",
    "password": "Gnerai123"
  }')

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "❌ Error al autenticarse"
  echo "$AUTH_RESPONSE" | jq '.' 2>/dev/null || echo "$AUTH_RESPONSE"
  exit 1
fi

echo "✅ Autenticado correctamente"
echo ""

# Crear usuario Owner
echo "📧 Creando Owner: cortadamarc13@gmail.com"
OWNER_RESPONSE=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "{
    \"email\": \"cortadamarc13@gmail.com\",
    \"password\": \"Gnerai123\",
    \"fullName\": \"Owner Gnerai Systems\",
    \"company_id\": \"${COMPANY_ID}\",
    \"role\": \"owner\"
  }")

echo "$OWNER_RESPONSE" | jq '.' 2>/dev/null || echo "$OWNER_RESPONSE"
echo ""

# Crear usuario Worker
echo "📧 Creando Worker: marcsanjuansard@gmail.com"
WORKER_RESPONSE=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "{
    \"email\": \"marcsanjuansard@gmail.com\",
    \"password\": \"Gnerai123\",
    \"fullName\": \"Trabajador Gnerai Systems\",
    \"company_id\": \"${COMPANY_ID}\",
    \"role\": \"worker\"
  }")

echo "$WORKER_RESPONSE" | jq '.' 2>/dev/null || echo "$WORKER_RESPONSE"
echo ""

echo "✅ Proceso completado"
