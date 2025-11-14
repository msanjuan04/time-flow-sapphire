# 🔐 Pasos para Configurar Superadmin

## ⚠️ IMPORTANTE: Ejecuta estos pasos EN ORDEN

### Paso 1: Verificar Proyecto ID
El proyecto ID actual es: `fyyhkdishlythkdnojdh`
La URL es: `https://fyyhkdishlythkdnojdh.supabase.co`

### Paso 2: Configurar Variables de Entorno

Asegúrate de tener las siguientes variables configuradas:

```bash
export SUPABASE_URL="https://fyyhkdishlythkdnojdh.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key-aqui"
```

**¿Dónde obtener el SERVICE_ROLE_KEY?**
1. Ve a: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/api
2. Busca "service_role" key (secret)
3. Cópialo

### Paso 3: Ejecutar Script de Superadmin

Una vez configuradas las variables:

```bash
cd /ruta/a/tu/proyecto
npm run ensure:superadmin
```

O directamente con el script de bash:

```bash
SUPABASE_SERVICE_ROLE_KEY='tu-key' ./ejecutar-ensure-superadmin.sh
```

### Paso 4: Verificar Creación

El script debería mostrar:

```
✅ Superadmin listo: gnerai@gneraitiq.com (ID ...)
🔐 Código de acceso: 739421
```

### Paso 5: Probar Login

1. Ve a tu app: http://localhost:8080/auth (o tu URL de producción)
2. Ingresa el código: `739421`
3. Deberías ser redirigido a `/admin`

### 🔍 Si algo falla

**Error: "User not found in auth.users"**
- El usuario no existe en la tabla auth.users de Supabase
- Ejecuta nuevamente `npm run ensure:superadmin`

**Error: "Unauthorized: No valid session"**
- Los tokens JWT no se están generando correctamente
- Verifica que el SERVICE_ROLE_KEY sea correcto
- Limpia localStorage y vuelve a hacer login

**Error: "Invalid code"**
- El código 739421 no está en la tabla profiles
- Ejecuta nuevamente `npm run ensure:superadmin`

### 🛠️ Verificar Manualmente en Base de Datos

Puedes verificar que todo esté correcto ejecutando estas queries en tu base de datos:

```sql
-- Verificar usuario en profiles
SELECT id, email, login_code FROM profiles WHERE email = 'gnerai@gneraitiq.com';

-- Verificar superadmin
SELECT * FROM superadmins WHERE user_id IN (
  SELECT id FROM profiles WHERE email = 'gnerai@gneraitiq.com'
);

-- Verificar usuario en auth.users
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'gnerai@gneraitiq.com';
```

### 📝 Datos del Superadmin

- Email: `gnerai@gneraitiq.com`
- Código de acceso: `739421`
- Rol: Superadmin (acceso completo a todas las funciones admin)
