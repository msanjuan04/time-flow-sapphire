# 🔐 Sistema de Login con Código de 6 Dígitos

## ✅ Implementación Completada

El sistema de login ahora usa códigos de 6 dígitos en lugar de contraseñas tradicionales.

## 📋 Códigos de Usuarios Existentes

| Email | Código | Rol | Estado |
|-------|--------|-----|--------|
| `gnerai@gneraitiq.com` | **521332** | Superadmin | ✅ Activo |
| `cortadamarc13@gmail.com` | **033797** | Owner | ✅ Activo |
| `marcsanjuansard@gmail.com` | **447407** | Worker | ✅ Activo |

## 🔧 Configuración

### Migración Aplicada
- ✅ Campo `login_code` agregado a la tabla `profiles`
- ✅ Índice único creado para búsquedas rápidas
- ✅ Códigos generados para todos los usuarios existentes

### Función Edge Function
- ✅ `login-with-code` desplegada y activa
- ✅ Configurada con `verify_jwt = false` para acceso público
- ✅ Validación de código de 6 dígitos
- ✅ Verificación de usuario activo

### Frontend
- ✅ Página `/auth` actualizada para usar código
- ✅ `AuthContext` actualizado con `signInWithCode`
- ✅ Validación de formato (6 dígitos numéricos)

## 🔑 Secretos Necesarios

La función `login-with-code` requiere los siguientes secretos configurados en Supabase:

1. **SUPABASE_URL** - Automáticamente inyectado
2. **SUPABASE_SERVICE_ROLE_KEY** - Automáticamente inyectado
3. **SITE_URL** - URL del frontend (por defecto: `http://localhost:8081`)

### Configurar SITE_URL

Si el frontend está en producción, actualiza el secreto:

```bash
# Desde el dashboard de Supabase:
# Settings > Edge Functions > Secrets
# Agregar: SITE_URL = https://tu-dominio.com
```

O desde el CLI (si tienes permisos):
```bash
supabase secrets set SITE_URL=https://tu-dominio.com --project-ref fyyhkdishlythkdnojdh
```

## 📝 Cómo Funciona

1. Usuario ingresa su código de 6 dígitos en `/auth`
2. Frontend llama a la función Edge `login-with-code`
3. La función busca el usuario por `login_code` en `profiles`
4. Si el código es válido y el usuario está activo, genera un token de sesión
5. El frontend usa el token para iniciar sesión automáticamente

## 🔄 Regenerar Códigos

Para regenerar el código de un usuario:

```sql
-- Regenerar código para un usuario específico
UPDATE public.profiles
SET login_code = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0')
WHERE id = 'USER_ID_AQUI'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p2 
  WHERE p2.login_code = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0')
);

-- Ver el nuevo código
SELECT u.email, p.login_code
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.id = 'USER_ID_AQUI';
```

## 🔒 Seguridad

- Los códigos son únicos (constraint UNIQUE)
- Solo usuarios activos pueden iniciar sesión
- Los códigos se validan en el servidor (Edge Function)
- No se almacenan contraseñas en texto plano

## 📱 Uso

1. Ve a `/auth`
2. Ingresa tu código de 6 dígitos
3. Haz clic en "Entrar"
4. Serás redirigido automáticamente a la página principal

## ⚠️ Notas Importantes

- Los códigos son personales e intransferibles
- Si olvidas tu código, contacta con un administrador
- Los códigos pueden regenerarse desde el dashboard de Supabase
- El sistema de fichaje y otros módulos NO se ven afectados

## 🛠️ Mantenimiento

### Consultar códigos de todos los usuarios:
```sql
SELECT 
  u.email,
  p.login_code,
  p.full_name,
  p.is_active
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.login_code IS NOT NULL
ORDER BY u.email;
```

### Regenerar todos los códigos:
```sql
-- CUIDADO: Esto regenerará TODOS los códigos
UPDATE public.profiles
SET login_code = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0')
WHERE login_code IS NOT NULL;
```

