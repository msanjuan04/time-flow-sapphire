#!/bin/bash

# Script para crear usuarios y asociarlos a la empresa

COMPANY_ID="d7babcd0-2d90-4300-a4b7-4d394351be6c"
PROJECT_REF="fyyhkdishlythkdnojdh"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

# Necesitamos el service role key para crear usuarios
# Por ahora usaremos la función admin-create-superadmin como base
# pero mejor creamos los usuarios directamente

echo "🔐 Creando usuarios para Gnerai Systems S.L..."
echo ""

# Crear usuario Owner
echo "📧 Creando Owner: cortadamarc13@gmail.com"
OWNER_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eWhrZGlzaGx5dGhrZG5vamRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk4MjI3OSwiZXhwIjoyMDc4NTU4Mjc5fQ.placeholder" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eWhrZGlzaGx5dGhrZG5vamRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk4MjI3OSwiZXhwIjoyMDc4NTU4Mjc5fQ.placeholder" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cortadamarc13@gmail.com",
    "password": "Gnerai123",
    "email_confirm": true,
    "user_metadata": {
      "full_name": "Owner Gnerai Systems"
    }
  }')

echo "$OWNER_RESPONSE" | jq '.' 2>/dev/null || echo "$OWNER_RESPONSE"
