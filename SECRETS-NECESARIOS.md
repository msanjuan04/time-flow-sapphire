# 🔐 Secrets Necesarios para Edge Functions

## 📋 Secrets Requeridos

Para que las Edge Functions funcionen correctamente, necesitas configurar estos secrets en Supabase:

### 1. Secrets Básicos (OBLIGATORIOS)

**SUPABASE_URL**
- Valor: `https://fyyhkdishlythkdnojdh.supabase.co`
- Dónde obtenerlo: Ya lo tienes (es la URL de tu proyecto)

**SUPABASE_ANON_KEY**
- Valor: Tu anon key (pública)
- Dónde obtenerlo: 
  - Dashboard → Settings → API
  - O desde tu archivo `.env` (VITE_SUPABASE_ANON_KEY)

**SUPABASE_SERVICE_ROLE_KEY**
- Valor: Tu service role key (SECRETA, no la compartas)
- Dónde obtenerlo:
  - Dashboard → Settings → API
  - Busca "service_role" key (es secreta, solo se muestra una vez)

### 2. Secrets para Emails (OPCIONAL pero recomendado)

**RESEND_API_KEY**
- Valor: Tu API key de Resend
- Dónde obtenerlo:
  - Crea cuenta en https://resend.com
  - Ve a API Keys y crea una nueva
  - Cópiala aquí

**EMAIL_FROM**
- Valor: `GTiQ <no-reply@tudominio.com>`
- Ejemplo: `GTiQ <no-reply@gtiq.com>`

**SITE_URL**
- Valor: URL pública de tu app
- Ejemplo: `https://app.tudominio.com` o `http://localhost:8080` para desarrollo

## 🚀 Cómo Configurarlos

### Opción 1: Usando el Script (Recomendado)

```bash
cd /Users/gnerai/gtiq/time-flow-sapphire
./configure-secrets.sh
```

El script te pedirá cada valor y los configurará automáticamente.

### Opción 2: Manualmente con Supabase CLI

```bash
supabase secrets set --project-ref fyyhkdishlythkdnojdh \
  SUPABASE_URL="https://fyyhkdishlythkdnojdh.supabase.co" \
  SUPABASE_ANON_KEY="tu_anon_key_aqui" \
  SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key_aqui" \
  RESEND_API_KEY="tu_resend_key_aqui" \
  EMAIL_FROM="GTiQ <no-reply@tudominio.com>" \
  SITE_URL="https://app.tudominio.com"
```

### Opción 3: Desde el Dashboard de Supabase

1. Ve a: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/functions
2. Busca "Secrets" o "Environment Variables"
3. Agrega cada secret manualmente

## ⚠️ Importante

- **SUPABASE_SERVICE_ROLE_KEY** es SECRETA, no la compartas nunca
- Sin **RESEND_API_KEY**, las invitaciones por email no funcionarán
- Puedes configurar los secrets de email más tarde si no los tienes ahora

