# TimeTrack - Sistema de Control Horario

Sistema profesional de control horario (fichaje) para empresas construido con React, TypeScript, Tailwind CSS y Lovable Cloud.

## Características

- 🔐 **Autenticación**: Login y registro con email/contraseña
- 👥 **Sistema de roles**: Owner, Admin, Manager y Worker
- 🏢 **Multi-empresa**: Cada empresa tiene su espacio aislado
- ⏱️ **Fichaje rápido**: Workers pueden fichar entrada/salida/pausas
- 📊 **Dashboard**: Métricas y visualización para administradores
- 🎨 **Diseño Apple**: Interfaz limpia con efecto "liquid glass"
- 🔵 **Marca personalizada**: Color azul GnerAI (#1A6AFF)

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + Vitest para testing
- **Estilos**: Tailwind CSS + Shadcn UI
- **Backend**: Lovable Cloud (Supabase)
- **Base de datos**: PostgreSQL con RLS
- **Autenticación**: Supabase Auth
- **Testing**: Vitest + Testing Library

## Estructura de Base de Datos

### Tablas principales

- **companies**: Empresas registradas
- **profiles**: Perfiles de usuarios (extiende auth.users)
- **memberships**: Relación usuario-empresa con roles
- **time_events**: Eventos de fichaje (entrada/salida/pausa)
- **work_sessions**: Sesiones de trabajo calculadas
- **incidents**: Incidencias automáticas de fichaje
- **notifications**: Notificaciones para admins y workers
- **correction_requests**: Solicitudes de corrección de fichajes

### Roles

- **Owner**: Control total de la empresa
- **Admin**: Gestión y visualización completa
- **Manager**: Visualización del equipo asignado y revisión de incidencias/correcciones
- **Worker**: Solo puede fichar entrada/salida/pausas

## Cómo empezar

### Primer registro

1. Ve a `/auth` e inicia sesión con tu código de 6 dígitos.
2. Si eres superadmin, ejecuta `npm run ensure:superadmin` y usa el código 739421.
3. Al crear una empresa se asigna automáticamente al usuario como Owner.

### Agregar empleados

Owners y Admins pueden invitar empleados desde **Gestión de Empleados → Invitaciones pendientes**. El flujo crea un registro en Supabase, envía email (via Resend) y permite reenviar o revocar desde la UI.

## Testing y QA

Se añadió Vitest con Testing Library para tests de componentes y hooks.

```bash
npm run test        # ejecuta Vitest una vez
npm run test:watch  # Vitest en modo watch
npm run test:ci     # Vitest run para CI
```

Archivo de configuración: `vitest.config.ts`. Los tests residen en `src/**/*.test.tsx` o `__tests__`.

### Verificación de esquema y funciones

- Las migraciones viven en `supabase/migrations`. Ejecuta `supabase migration status` y `supabase migrate up` para validar el esquema.
- Para health checks de Edge Functions puedes usar `supabase functions deploy --dry-run` y el dashboard de Supabase (Health tab) o scripts que hagan ping a `/functions/v1/<func>`.
- Recomendado: configurar alertas en Supabase (Settings → Monitoring) para edge function failures y anomalias en la base de datos.

## Monitorización y alertas

1. **Supabase Logs & Alerts**: Configura en el dashboard alertas basadas en query performance y edge function errors (Settings → Logs/Monitoring → Alerts). Ejemplos:
   - Error rate > 5% en `clock`
   - # de incidencias diarias por encima de un umbral
2. **Health Checks**: Añade un endpoint simple en cada función crítica que responda `200 ok` (ej. `clock` con `OPTIONS`). Usa servicios como UptimeRobot o Supabase Health.
3. **Vitest en CI**: Ejecuta `npm run test:ci` antes de desplegar. Para pipelines, combine `npm run lint && npm run test:ci && npm run build`.

## Contribución

1. `npm install`
2. `npm run dev`
3. Ejecuta `npm run test:watch` mientras desarrollas

## Dependencias críticas

- `supabase.functions.*` (clock, create-invite, resend-invite, revoke-invite, request-login-code, list-invites)
- `scripts/ensure-superadmin.mjs`

## SUPERADMIN

- email: `gnerai@gneraitiq.com`
- código: `739421`

Ejecútalo mediante `npm run ensure:superadmin` tras configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

## Deploy

### Frontend (Vercel / Netlify)

Ambos proveedores siguen los mismos pasos básicos:

1. **Comando de build**: `npm run build`
2. **Directorio de publicación**: `dist/`
3. **Variables de entorno (todas en el panel del hosting, nunca en el código)**  
   - `VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co`  
   - `VITE_SUPABASE_ANON_KEY=tu_anon_key`
   - `VITE_SUPABASE_PROJECT_ID=tu_project_id`
4. **Comando de pre-deploy recomendado**: `npm run test:ci && npm run build` (en Vercel usa el campo “Build Command”).  
   Esto garantiza que Vitest pase antes de publicar.  
5. **Variables para funciones**: usa `supabase secrets set` para `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, etc. Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` en el frontend.

Notas específicas:

- **Vercel**: en Project Settings → Environment Variables, define las `VITE_...`. Activa “Automatic Prerender” y usa `npm run test:ci && npm run build`. Para pruebas post-deploy, habilita [Checks](https://vercel.com/docs/checks) y añade `npm run test:ci`.
- **Netlify**: en Site settings → Build & deploy, establece `cmd: npm run build`, `Publish directory: dist`. En “Environment”, añade las `VITE_...`. Para tests automáticos usa los [Build Plugins](https://docs.netlify.com/configure-builds/build-plugins/) o define `npm run test:ci && npm run build`.

### Supabase

- `supabase functions deploy <name>` (clock, create-invite, request-login-code, etc.)
- `supabase secrets set` para `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.
- `supabase migrate status && supabase migrate up` para validar el esquema antes de desplegar.

## Próximas funcionalidades

- Reportes avanzados y exportaciones
- App móvil
- Integración con payroll
- Señales de geolocalización avanzada

---
Desarrollado con ❤️ usando Lovable Cloud
