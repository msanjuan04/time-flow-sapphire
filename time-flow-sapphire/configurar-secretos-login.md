# 🔐 Configurar Secretos para Login con Código

## Secretos Requeridos

La función `login-with-code` necesita los siguientes secretos configurados en Supabase:

### 1. Secretos Automáticos (Ya Configurados)
- ✅ `SUPABASE_URL` - Inyectado automáticamente
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Inyectado automáticamente
- ✅ `SUPABASE_ANON_KEY` - Inyectado automáticamente

### 2. Secreto Manual: SITE_URL

**SITE_URL** es necesario para generar los links de autenticación correctamente.

#### Opción A: Dashboard de Supabase (Recomendado)

1. Ve a: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/functions
2. Busca la sección "Secrets"
3. Haz clic en "Add new secret"
4. Nombre: `SITE_URL`
5. Valor:
   - **Desarrollo local:** `http://localhost:8081`
   - **Producción:** `https://tu-dominio.com`
6. Guarda el secreto

#### Opción B: CLI (Si tienes permisos)

```bash
# Para desarrollo local
supabase secrets set SITE_URL=http://localhost:8081 --project-ref fyyhkdishlythkdnojdh

# Para producción
supabase secrets set SITE_URL=https://tu-dominio.com --project-ref fyyhkdishlythkdnojdh
```

## Verificar Configuración

Para verificar que los secretos están configurados:

1. Ve al dashboard: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/functions
2. Revisa la lista de "Secrets"
3. Deberías ver `SITE_URL` en la lista

## Nota Importante

Si `SITE_URL` no está configurado, la función usará `http://localhost:8081` por defecto, lo cual funciona para desarrollo local pero puede causar problemas en producción.

