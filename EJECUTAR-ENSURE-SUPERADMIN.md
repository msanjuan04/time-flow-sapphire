# 🚀 Ejecutar ensure:superadmin

## Pasos Rápidos

### 1. Obtener SERVICE_ROLE_KEY

Ve a: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/api

Copia el **service_role** key (secret).

### 2. Exportar Variables y Ejecutar

```bash
cd /Users/gnerai/gtiq/time-flow-sapphire

export SUPABASE_URL="https://fyyhkdishlythkdnojdh.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key-aqui"

npm run ensure:superadmin
```

### 3. Verificar Resultado

El script debería mostrar:
- ✅ Superadmin listo: gnerai@gneraitiq.com
- 🔐 Código asignado: [código]

## Qué Hace el Script

1. Verifica si existe el usuario `gnerai@gneraitiq.com`
2. Si no existe, lo crea
3. Crea/actualiza el perfil en `profiles`
4. Asigna el código de login (o mantiene el existente)
5. Asegura que esté en la tabla `superadmins`

## Nota

El script está configurado para usar el código `739421` por defecto, pero si el usuario ya tiene un código, lo mantendrá.

