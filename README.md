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

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS + Shadcn UI
- **Backend**: Lovable Cloud (Supabase)
- **Base de datos**: PostgreSQL con RLS
- **Autenticación**: Supabase Auth

## Estructura de Base de Datos

### Tablas principales

- **companies**: Empresas registradas
- **profiles**: Perfiles de usuarios (extiende auth.users)
- **memberships**: Relación usuario-empresa con roles
- **time_events**: Eventos de fichaje (entrada/salida/pausa)
- **work_sessions**: Sesiones de trabajo calculadas

### Roles

- **Owner**: Control total de la empresa
- **Admin**: Gestión y visualización completa
- **Manager**: Visualización del equipo asignado
- **Worker**: Solo puede fichar entrada/salida/pausas

## Cómo empezar

### Primer registro

1. Ve a `/auth` y regístrate con tu email
2. Automáticamente se te redirigirá al onboarding
3. Crea tu empresa (serás asignado como Owner)
4. ¡Listo para usar!

### Agregar empleados

Los Owners y Admins pueden:
1. Crear cuentas para empleados
2. Asignarles roles directamente en la base de datos (por ahora)
3. Los empleados recibirán acceso según su rol

### Testing rápido

Para probar los diferentes roles, crea múltiples cuentas y asígnales roles en la tabla `memberships` desde el panel de Lovable Cloud:

```sql
-- Ejemplo: Asignar rol worker a un usuario
UPDATE memberships 
SET role = 'worker' 
WHERE user_id = '[user-id-aquí]';
```

## Vistas por rol

### Worker
- Botón grande de fichar entrada/salida
- Indicador de tiempo transcurrido
- Gestión de pausas
- Interfaz simple y directa

### Admin/Owner
- Dashboard con métricas
- Usuarios activos en tiempo real
- Listado de fichajes recientes
- Estadísticas del día

### Manager
- Vista del equipo asignado (próximamente)
- Métricas de su departamento

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Abrir en http://localhost:8080
```

## Diseño

El sistema utiliza un diseño inspirado en Apple con:
- Efecto "liquid glass" (glassmorphism)
- Color primario: GnerAI Blue (#1A6AFF)
- Fuentes del sistema (SF Pro Display)
- Animaciones suaves y fluidas
- Diseño responsive

## Seguridad

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Aislamiento por empresa
- ✅ Autenticación segura con Supabase
- ✅ Roles almacenados en tabla separada
- ✅ Validación de permisos en el backend

## Próximas funcionalidades

- [ ] Panel de gestión de empleados
- [ ] Vista de Manager con filtros de equipo
- [ ] Reportes y exportación de datos
- [ ] Notificaciones push
- [ ] Geolocalización de fichajes
- [ ] Aplicación móvil

## Soporte

Para más información sobre Lovable Cloud:
- [Documentación oficial](https://docs.lovable.dev/)
- [Guía de Cloud](https://docs.lovable.dev/features/cloud)

---

Desarrollado con ❤️ usando Lovable
