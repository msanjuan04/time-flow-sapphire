# 🚀 Desplegar Edge Functions desde el Dashboard

Como el CLI requiere privilegios especiales, despliega las funciones desde el dashboard de Supabase.

## 📋 Pasos

### 1. Accede al Dashboard

Ve a: **https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/functions**

### 2. Despliega cada función

Para cada función en la lista, haz clic en **"Deploy"** o **"Create function"**:

#### Funciones principales:
- ✅ `clock` - Fichaje de entrada/salida
- ✅ `create-invite` - Crear invitaciones
- ✅ `resend-invite` - Reenviar invitaciones
- ✅ `revoke-invite` - Revocar invitaciones
- ✅ `list-invites` - Listar invitaciones
- ✅ `list-people` - Listar personas
- ✅ `update-person` - Actualizar persona
- ✅ `delete-person` - Eliminar persona
- ✅ `reactivate-person` - Reactivar persona
- ✅ `notify-correction-request` - Notificar solicitudes de corrección

#### Funciones de admin:
- ✅ `admin-autoclose-sessions` - Cerrar sesiones automáticamente
- ✅ `admin-create-company` - Crear empresa
- ✅ `admin-create-invite` - Crear invitación (admin)
- ✅ `admin-create-superadmin` - Crear superadmin
- ✅ `admin-get-company` - Obtener empresa
- ✅ `admin-impersonate` - Impersonar usuario
- ✅ `admin-list-companies` - Listar empresas
- ✅ `admin-list-logs` - Listar logs
- ✅ `admin-list-users` - Listar usuarios
- ✅ `admin-set-company-status` - Establecer estado de empresa
- ✅ `admin-stats` - Estadísticas
- ✅ `admin-stop-impersonate` - Detener impersonación
- ✅ `admin-transfer-ownership` - Transferir propiedad

### 3. Al desplegar cada función

1. Haz clic en **"Create function"** o **"Deploy"**
2. Nombre: usa el nombre de la función (ej: `clock`)
3. Código: copia el contenido de `supabase/functions/[nombre]/index.ts`
4. Si la función usa archivos compartidos (`_shared/`), también cópialos

### 4. Verificar el despliegue

Una vez desplegadas, deberían aparecer en la lista de funciones.

## ⚡ Alternativa Rápida

Si tienes acceso a Lovable, puedes:
1. Conectar Lovable al nuevo proyecto Supabase
2. Lovable puede desplegar las funciones automáticamente

## ✅ Después del Despliegue

Una vez desplegadas todas las funciones:
1. Verifica que aparezcan en el dashboard
2. Prueba el sistema ejecutando `npm run dev`
3. Prueba registro, login y fichajes

