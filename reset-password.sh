#!/bin/bash

# Script para resetear la contraseña de un usuario

PROJECT_REF="fyyhkdishlythkdnojdh"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eWhrZGlzaGx5dGhrZG5vamRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODIyNzksImV4cCI6MjA3ODU1ODI3OX0.1tAqRaA9hDl1wozBxYzA9Ms1mHVULtJbdAgoRLgy5jk"

echo "🔐 Reseteo de contraseña de usuario"
echo ""
echo "Usuarios disponibles:"
echo "1. gnerai@gneraitiq.com (Superadmin)"
echo "2. cortadamarc13@gmail.com (Owner)"
echo "3. marcsanjuansard@gmail.com (Worker)"
echo ""

read -p "Email del usuario: " EMAIL
read -p "Nueva contraseña: " PASSWORD

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "❌ Email y contraseña son requeridos"
  exit 1
fi

echo ""
echo "🔄 Reseteando contraseña para $EMAIL..."

# Necesitamos usar el service role key para resetear contraseñas
# Por ahora, vamos a usar la API de admin de Supabase
# Nota: Esto requiere el service role key que no tenemos en el script
# Mejor opción: usar la función Edge Function o el dashboard

echo ""
echo "⚠️  Para resetear la contraseña, puedes:"
echo "1. Ir al dashboard de Supabase: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users"
echo "2. Buscar el usuario por email"
echo "3. Hacer clic en 'Reset Password' o editar manualmente"
echo ""
echo "O usar la función Edge Function admin-create-superadmin con verify_jwt=false"
echo "para crear/actualizar usuarios con contraseñas."

