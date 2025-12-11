#!/bin/bash
# Script para crear el archivo .env con las credenciales de Supabase

cat > .env << 'EOF'
# Supabase Configuration
# Establece los valores de tu proyecto antes de ejecutar este script
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=REEMPLAZA_CON_TU_ANON_KEY
VITE_SUPABASE_PROJECT_ID=TU_PROJECT_ID
EOF

echo "✅ Archivo .env creado!"
echo "⚠️  IMPORTANTE: Edita .env y reemplaza los valores con los de tu proyecto Supabase"
