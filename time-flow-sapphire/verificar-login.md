# 🔍 Verificación de Login

## Problema
Error `invalid_credentials` al intentar iniciar sesión.

## Usuarios Disponibles

### 1. Superadmin
- **Email:** `gnerai@gneraitiq.com`
- **Password:** `Gnerai123`
- **Estado:** ✅ Creado, email confirmado, perfil activo

### 2. Owner (Gnerai Systems S.L.)
- **Email:** `cortadamarc13@gmail.com`
- **Password:** `Gnerai123`
- **Estado:** ✅ Creado, email confirmado, perfil activo

### 3. Worker (Gnerai Systems S.L.)
- **Email:** `marcsanjuansard@gmail.com`
- **Password:** `Gnerai123`
- **Estado:** ✅ Creado, email confirmado, perfil activo

## Posibles Causas del Error

1. **Contraseña incorrecta:** Asegúrate de usar exactamente `Gnerai123` (con mayúscula G, minúsculas, y números)
2. **Email con espacios:** Asegúrate de no tener espacios antes o después del email
3. **Problema con el hash de contraseña:** Si los usuarios se crearon con la función Edge Function, las contraseñas deberían estar correctamente hasheadas

## Solución: Resetear Contraseña

Si el problema persiste, puedes resetear la contraseña desde el dashboard de Supabase:

1. Ve a: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/auth/users
2. Busca el usuario por email
3. Haz clic en el usuario
4. En la sección "Password", haz clic en "Reset Password" o edita manualmente
5. Establece la nueva contraseña como `Gnerai123`

## Verificar en la Consola del Navegador

Abre la consola del navegador (F12) y verifica:
- ¿Qué email estás usando?
- ¿Hay algún error adicional en la consola?
- ¿El error aparece inmediatamente o después de unos segundos?

## Prueba Directa

Puedes probar el login directamente usando la consola del navegador:

```javascript
// En la consola del navegador
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'cortadamarc13@gmail.com',
  password: 'Gnerai123'
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('✅ Login exitoso:', data.user.email);
}
```

