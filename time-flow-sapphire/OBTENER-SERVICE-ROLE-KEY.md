# 🔑 Obtener SERVICE_ROLE_KEY

## Pasos para obtener el SERVICE_ROLE_KEY

1. Ve al dashboard de Supabase:
   https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/api

2. En la sección "Project API keys", busca:
   - **service_role** (secret) - Este es el que necesitas

3. Haz clic en el icono de "eye" o "show" para revelar la clave

4. Copia la clave completa

## Ejecutar ensure:superadmin

Una vez que tengas el SERVICE_ROLE_KEY, ejecuta:

```bash
cd /Users/gnerai/gtiq/time-flow-sapphire

export SUPABASE_URL="https://fyyhkdishlythkdnojdh.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key-aqui"

npm run ensure:superadmin
```

## Nota de Seguridad

⚠️ **IMPORTANTE**: El SERVICE_ROLE_KEY es una clave secreta que otorga acceso completo a tu proyecto. 
- **NUNCA** lo subas a Git
- **NUNCA** lo compartas públicamente
- Solo úsalo en scripts locales o en entornos seguros

## Alternativa: Usar el script helper

También puedes usar el script helper:

```bash
SUPABASE_SERVICE_ROLE_KEY="tu-key" ./ejecutar-ensure-superadmin.sh
```

