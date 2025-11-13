# ✅ Verificación Completa del Frontend con Backend

## 🔍 Estado Actual

✅ **Configuración verificada:**
- `.env` actualizado con las credenciales correctas
- `config.toml` configurado con el project_id correcto
- Conexión a Supabase funcionando (HTTP 200)
- 21 Edge Functions desplegadas y activas

## 🧪 Pruebas a Realizar

### 1. Iniciar el Servidor de Desarrollo

```bash
cd time-flow-sapphire
npm run dev
```

El servidor debería iniciar en `http://localhost:8080`

### 2. Verificar Conexión Básica

1. Abre el navegador en `http://localhost:8080`
2. Abre la consola del desarrollador (F12)
3. Verifica que no haya errores de conexión a Supabase

### 3. Probar Autenticación

#### Crear una cuenta de prueba:
1. Ve a la página de registro/login
2. Crea una cuenta nueva
3. Verifica que puedas iniciar sesión

**Nota:** Como la base de datos está vacía, necesitarás crear un superadmin primero o usar la función `admin-create-superadmin`.

### 4. Probar Funcionalidades Principales

#### A. Fichaje (Clock Function)
- Inicia sesión como trabajador
- Prueba hacer "Entrada" (clock in)
- Verifica que se registre correctamente
- Prueba "Salida" (clock out)

#### B. Gestión de Personas
- Como admin, prueba listar personas
- Prueba actualizar una persona
- Verifica que las funciones `list-people`, `update-person` funcionen

#### C. Invitaciones
- Como admin, prueba crear una invitación
- Verifica que la función `admin-create-invite` funcione
- Prueba listar invitaciones con `list-invites`

### 5. Verificar Edge Functions desde el Navegador

Abre la consola del navegador y ejecuta:

```javascript
// Verificar que supabase está configurado
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Project ID:', import.meta.env.VITE_SUPABASE_PROJECT_ID);

// Probar una función simple (después de autenticarte)
const { data, error } = await supabase.functions.invoke('clock', {
  body: { action: 'in', source: 'web' }
});
console.log('Clock function:', { data, error });
```

## 🔧 Solución de Problemas

### Error: "No active session"
- **Causa:** No estás autenticado
- **Solución:** Inicia sesión primero

### Error: "Function not found"
- **Causa:** La función no está desplegada o el nombre es incorrecto
- **Solución:** Verifica en el dashboard de Supabase que la función existe

### Error: "Unauthorized" o "Forbidden"
- **Causa:** No tienes permisos para acceder a la función
- **Solución:** Verifica que tu usuario tenga el rol correcto (superadmin, admin, etc.)

### Error: "SUPABASE_SERVICE_ROLE_KEY not configured"
- **Causa:** Los secrets de Edge Functions no están configurados
- **Solución:** Configura los secrets desde el dashboard de Supabase

## 📋 Checklist de Verificación

- [ ] Servidor de desarrollo inicia sin errores
- [ ] No hay errores en la consola del navegador
- [ ] Puedo crear una cuenta nueva
- [ ] Puedo iniciar sesión
- [ ] La función `clock` funciona (fichaje)
- [ ] Las funciones de listado funcionan (`list-people`, `list-invites`)
- [ ] Las funciones admin funcionan (requiere ser superadmin)
- [ ] Los datos se guardan correctamente en la base de datos

## 🚀 Próximos Pasos Después de Verificar

1. **Crear un superadmin:**
   - Usa la función `admin-create-superadmin` o crea uno manualmente en la base de datos

2. **Crear una empresa de prueba:**
   - Como superadmin, crea una empresa usando `admin-create-company`

3. **Crear usuarios de prueba:**
   - Crea invitaciones para diferentes roles (admin, manager, worker)

4. **Probar todas las funcionalidades:**
   - Fichajes
   - Reportes
   - Gestión de empleados
   - Correcciones
   - Etc.

## 📝 Notas Importantes

- **Base de datos vacía:** Como empezaste desde cero, necesitarás crear datos de prueba
- **Secrets de Edge Functions:** Asegúrate de configurar `RESEND_API_KEY`, `EMAIL_FROM`, y `SITE_URL` si quieres que los emails funcionen
- **Superadmin:** Necesitas crear al menos un superadmin para poder usar las funciones admin

## 🔗 Enlaces Útiles

- Dashboard de Supabase: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh
- Edge Functions: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/functions
- API Settings: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/settings/api
- Database: https://supabase.com/dashboard/project/fyyhkdishlythkdnojdh/editor

