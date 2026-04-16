# Checklist: actualizar la app en el servidor

Después de subir la app, revisa que todo esté configurado en tu hosting.

**Si usas tu propio servidor por SSH** (ej. `ssh root@46.101.185.148`): guía paso a paso en [docs-servidor/DEPLOY-SERVIDOR-SSH.md](docs-servidor/DEPLOY-SERVIDOR-SSH.md) (build, rsync, nginx, variables).

## 1. Build y publicación

- [ ] **Build command**: `npm run build` (o `npm run test:ci && npm run build` si quieres tests antes)
- [ ] **Publish directory**: `dist`
- [ ] **Node version**: 18 o superior (en la mayoría de hostings viene por defecto)

## 2. Variables de entorno (obligatorias)

Configúralas en el panel del hosting (Environment Variables). Sin estas, la app no funcionará bien en producción.

| Variable | Uso | Ejemplo |
|----------|-----|---------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima (pública) de Supabase | `eyJhbGc...` |
| `VITE_SUPABASE_PROJECT_ID` | ID del proyecto Supabase | `fyyhkdishlythkdnojdh` |

## 3. Variables de entorno (recomendadas)

| Variable | Uso | Ejemplo |
|----------|-----|---------|
| `VITE_PUBLIC_SITE_URL` | URL pública de la app (QR, enlaces, redirects) | `https://gneraitiq.com` |
| `VITE_MAPBOX_PUBLIC_TOKEN` | Token de Mapbox para mapas (reportes de ubicación) | `pk.eyJ1...` |

Si no pones `VITE_PUBLIC_SITE_URL`, la URL del sitio puede fallar en dispositivos/QR. Si no pones `VITE_MAPBOX_PUBLIC_TOKEN`, los mapas en reportes de ubicación no cargarán.

## 4. Redirecciones (SPA)

Si alguien entra directo a una ruta como `/dashboard` o `/auth`, el servidor debe devolver `index.html` para que React Router funcione.

- **Vercel**: suele venir bien con el preset de SPA.
- **Netlify**: añade un `_redirects` o en "Redirects" → `/* /index.html 200`.
- **Otro servidor (nginx, Apache, etc.)**: configura fallback a `index.html` para rutas que no sean archivos estáticos.

## 5. Supabase (backend)

Si también gestionas el backend en Supabase:

- [ ] **Edge Functions** desplegadas: `supabase functions deploy <nombre>` (clock, create-invite, request-login-code, resend-invite, revoke-invite, list-invites, etc.)
- [ ] **Secrets** en Supabase: `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` (debe ser la URL pública de la app, ej. `https://gneraitiq.com`)
- [ ] **Migraciones** aplicadas: `supabase migration status` y `supabase migrate up` si hace falta

## 6. Después de cambiar variables

En Vite, las variables `VITE_*` se inyectan en el **build**. Si cambias algo en el panel del hosting:

1. Guarda los cambios.
2. Lanza un **nuevo deploy** (redeploy) para que el build use las variables nuevas.

No basta con cambiar la variable y recargar la página; hace falta volver a hacer build.

## Resumen rápido

1. Build: `npm run build`, publicar `dist/`.
2. Definir en el hosting: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`.
3. Opcional pero recomendado: `VITE_PUBLIC_SITE_URL`, `VITE_MAPBOX_PUBLIC_TOKEN`.
4. Redirecciones SPA: `/* → index.html 200`.
5. Tras cambiar env vars, hacer un nuevo deploy.
