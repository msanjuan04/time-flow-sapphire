# 🔐 Configurar Secrets Manualmente desde el Dashboard

Como el CLI requiere privilegios especiales, configura los secrets desde el dashboard de Supabase.

## 📋 Pasos

### 1. Accede al Dashboard de Supabase

Ve a: **https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/functions**

### 2. Busca la sección "Secrets" o "Environment Variables"

### 3. Agrega estos secrets (si tienes Resend configurado):

**RESEND_API_KEY**
- Valor: Tu API key de Resend
- Ejemplo: `re_1234567890abcdef...`

**EMAIL_FROM**
- Valor: `GTiQ <no-reply@tudominio.com>`
- O para desarrollo: `GTiQ <no-reply@gtiq.local>`

**SITE_URL**
- Valor: `http://localhost:8080` (para desarrollo)
- O cuando publiques: `https://tu-dominio.com`

## ⚠️ Importante

- **SUPABASE_URL**, **SUPABASE_ANON_KEY** y **SUPABASE_SERVICE_ROLE_KEY** se inyectan automáticamente, NO los agregues manualmente.

## ✅ Después de Configurar

Una vez configurados los secrets, puedes desplegar las Edge Functions.

