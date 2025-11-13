# Configurar Permisos del CLI de Supabase

## 🔍 Problema Actual

El CLI de Supabase no tiene permisos para desplegar funciones porque no eres **owner** del proyecto o no tienes permisos de **administrador**.

## ✅ Soluciones

### Opción 1: Verificar y Obtener Permisos (Recomendado)

1. **Verifica si eres owner del proyecto:**
   - Ve a: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/team
   - Si no apareces como "Owner", necesitas que el owner te invite

2. **Si no eres owner:**
   - Contacta al owner del proyecto
   - Pídele que te invite como colaborador con rol **"Administrator"** o **"Owner"**
   - Acepta la invitación en tu email

3. **Una vez tengas permisos:**
   ```bash
   cd time-flow-sapphire
   ./deploy-admin-functions.sh
   ```

### Opción 2: Desplegar desde el Dashboard (Alternativa)

Si no puedes obtener permisos de CLI, puedes desplegar manualmente:

1. **Ve al dashboard de funciones:**
   https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/functions

2. **Para cada función admin:**
   - Haz clic en "Deploy a new function" o "Edit function"
   - Selecciona la carpeta: `supabase/functions/admin-*/`
   - **IMPORTANTE:** Asegúrate de incluir la carpeta `_shared/` con todos sus archivos:
     - `_shared/admin.ts`
     - `_shared/cors.ts`
     - `_shared/validation.ts`

3. **Funciones a desplegar:**
   - `admin-create-invite`
   - `admin-list-companies`
   - `admin-list-users`
   - `admin-create-company`
   - `admin-impersonate`
   - `admin-stop-impersonate`
   - `admin-get-company`
   - `admin-set-company-status`
   - `admin-transfer-ownership`
   - `admin-stats`
   - `admin-list-logs`
   - `admin-autoclose-sessions`
   - `admin-create-superadmin`

### Opción 3: Verificar Autenticación

Si crees que deberías tener permisos:

1. **Cierra sesión y vuelve a iniciar:**
   ```bash
   supabase logout
   supabase login
   ```

2. **Verifica que estás autenticado:**
   ```bash
   supabase projects list
   ```

3. **Intenta hacer link del proyecto:**
   ```bash
   supabase link --project-ref fyyhkdishlythkdnojdh
   ```

## 📋 Estado Actual

✅ **Funciones ya desplegadas (8):**
- `clock`
- `list-invites`
- `list-people`
- `update-person`
- `delete-person`
- `reactivate-person`
- `revoke-invite`
- `create-invite`

⏳ **Funciones pendientes (13 funciones admin):**
- Todas las funciones que empiezan con `admin-*`

## 🚀 Script de Despliegue

He creado un script que intenta desplegar todas las funciones admin:

```bash
cd time-flow-sapphire
./deploy-admin-functions.sh
```

Si falla por permisos, te dará instrucciones específicas.

## 💡 Nota Importante

Las funciones admin **requieren** los archivos compartidos en `_shared/`:
- `_shared/admin.ts` - Validación de superadmin
- `_shared/cors.ts` - Headers CORS
- `_shared/validation.ts` - Utilidades de validación

Sin estos archivos, las funciones no funcionarán correctamente.

