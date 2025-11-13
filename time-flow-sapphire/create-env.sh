#!/bin/bash
# Script para crear el archivo .env con las credenciales de Supabase

cat > .env << 'EOF'
# Supabase Configuration
# Project: gtiq (fyyhkdishlythkdnojdh)
# Obtén VITE_SUPABASE_PUBLISHABLE_KEY desde: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/api
VITE_SUPABASE_URL=https://fyyhkdishlythkdnojdh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=REEMPLAZA_CON_TU_ANON_KEY
VITE_SUPABASE_PROJECT_ID=fyyhkdishlythkdnojdh
EOF

echo "✅ Archivo .env creado!"
echo "⚠️  IMPORTANTE: Edita .env y reemplaza REEMPLAZA_CON_TU_ANON_KEY con tu anon key real"
echo "   Obtén tu anon key desde: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/api"

