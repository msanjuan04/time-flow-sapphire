# 📍 Dónde Configurar los Secrets en Supabase

## ❌ NO es en "API Keys"

La sección "API Keys" es para obtener tus claves (anon key, service role key), pero **NO** es donde configuras los secrets de las Edge Functions.

## ✅ Dónde SÍ configurarlos

### Opción 1: Desde Edge Functions (Recomendado)

1. Ve a: **https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/functions**
2. O ve a: **Settings → Edge Functions**
3. Busca la sección **"Secrets"** o **"Environment Variables"**
4. Haz clic en **"Add new secret"** o **"Manage secrets"**
5. Agrega cada secret:
   - `RESEND_API_KEY` = tu API key de Resend
   - `EMAIL_FROM` = `GTiQ <no-reply@tudominio.com>`
   - `SITE_URL` = `http://localhost:8080`

### Opción 2: Desde Project Settings

1. Ve a: **https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/functions**
2. Busca la sección **"Secrets"** o **"Environment Variables"**
3. Agrega los secrets ahí

## 🔍 Si no encuentras la sección "Secrets"

Puede que aparezca como:
- **"Environment Variables"**
- **"Function Secrets"**
- **"Edge Function Secrets"**
- O al desplegar una función por primera vez

## 📝 Alternativa: Configurar al Desplegar

Si no encuentras la sección de secrets, puedes:
1. Desplegar las funciones primero
2. Luego configurar los secrets desde la página de cada función
3. O usar el dashboard cuando despliegues por primera vez

## ⚠️ Recordatorio

- **NO** configures `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Estos se inyectan automáticamente
- Solo configura: `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` (si tienes Resend)

