# 🚀 Instrucciones para Ejecutar ensure:superadmin

## Error Corregido

El script ha sido corregido para usar la API correcta de Supabase. El método `getUserByEmail` no existe en esta versión, ahora usa `getUserById` después de buscar en `profiles`.

## Pasos para Ejecutar

### 1. Obtener SERVICE_ROLE_KEY

1. Ve a: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/api
2. En "Project API keys", busca **service_role** (secret)
3. Haz clic en el icono de "eye" para revelar la clave
4. Copia la clave completa

### 2. Ejecutar el Script

```bash
cd /Users/gnerai/gtiq/time-flow-sapphire

# Exportar variables de entorno
export SUPABASE_URL="https://fyyhkdishlythkdnojdh.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key-aqui"

# Ejecutar el script
npm run ensure:superadmin
```

### 3. Resultado Esperado

Deberías ver algo como:

```
ℹ️  Usuario encontrado, actualizando configuración...
🔐 Código existente: 521332
✅ Superadmin listo: gnerai@gneraitiq.com (ID 655dcbf3-6ea2-4d5a-ba0b-98441a542331)
🔐 Código de acceso: 521332
```

## Qué Hace el Script

1. ✅ Busca el usuario `gnerai@gneraitiq.com` en `profiles`
2. ✅ Si existe, obtiene sus datos de `auth.users`
3. ✅ Si no existe, crea el usuario
4. ✅ Crea/actualiza el perfil en `profiles`
5. ✅ Asigna código de login (o mantiene el existente)
6. ✅ Asegura que esté en la tabla `superadmins`

## Nota

El script está configurado para usar el código `739421` por defecto, pero si el usuario ya tiene un código (como `521332`), lo mantendrá y no lo sobrescribirá.

