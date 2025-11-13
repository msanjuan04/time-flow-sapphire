#!/bin/bash

# Script para crear un superadmin en Supabase

EMAIL="${1:-gnerai@gneraitiq.com}"
PROJECT_REF="fyyhkdishlythkdnojdh"
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/admin-create-superadmin"

echo "🔐 Creando superadmin..."
echo ""

if [ -z "$EMAIL" ]; then
  echo "❌ Email requerido"
  echo "   Uso: ./crear-superadmin.sh [email]"
  exit 1
fi

echo "📧 Email: ${EMAIL}"
echo ""

# Solicitar contraseña de forma segura
read -sp "🔑 Ingresa la contraseña para el superadmin: " PASSWORD
echo ""

if [ -z "$PASSWORD" ]; then
  echo "❌ La contraseña no puede estar vacía"
  exit 1
fi

# Solicitar nombre completo (opcional)
read -p "👤 Nombre completo (opcional, presiona Enter para usar el email): " FULL_NAME
FULL_NAME=${FULL_NAME:-""}

echo ""
echo "🔄 Creando superadmin..."

# Llamar a la función Edge Function
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eWhrZGlzaGx5dGhrZG5vamRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODIyNzksImV4cCI6MjA3ODU1ODI3OX0.1tAqRaA9hDl1wozBxYzA9Ms1mHVULtJbdAgoRLgy5jk" \
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
  echo "🎉 Ahora puedes iniciar sesión con:"
  echo "   Email: ${EMAIL}"
  echo "   Password: [la que ingresaste]"
else
  echo "❌ Error al crear superadmin (HTTP ${HTTP_CODE})"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi

