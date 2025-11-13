# Verificar Configuración del CLI

## 🔍 Problema Actual

El CLI de Supabase no puede acceder al proyecto `fyyhkdishlythkdnojdh` porque:
- El CLI está autenticado con una cuenta diferente
- O el proyecto no existe en esa cuenta
- O no tienes permisos en ese proyecto

## ✅ Verificaciones

### 1. Verificar qué cuenta está usando el CLI

```bash
supabase projects list
```

Esto mostrará todos los proyectos a los que tienes acceso con la cuenta actual del CLI.

### 2. Verificar si el proyecto existe

El proyecto `fyyhkdishlythkdnojdh` debería aparecer en la lista. Si no aparece:
- El proyecto está en otra cuenta/organización
- O el proyecto no existe aún

### 3. Opciones

#### Opción A: Si el proyecto NO existe
Necesitas crear un nuevo proyecto en Supabase:
1. Ve a: https://supabase.com/dashboard
2. Crea un nuevo proyecto
3. Copia el `project_ref` (será algo como `fyyhkdishlythkdnojdh`)
4. Actualiza `supabase/config.toml` con el nuevo `project_ref`

#### Opción B: Si el proyecto existe pero en otra cuenta
1. Haz logout del CLI:
   ```bash
   supabase logout
   ```

2. Haz login con la cuenta correcta:
   ```bash
   supabase login
   ```

3. Verifica que puedes ver el proyecto:
   ```bash
   supabase projects list
   ```

4. Haz link del proyecto:
   ```bash
   supabase link --project-ref fyyhkdishlythkdnojdh
   ```

#### Opción C: Usar el MCP (ya funcionando)
El MCP de `supabase_gtiq` SÍ puede acceder al proyecto y ya desplegamos 8 funciones con éxito.

Para las funciones admin que faltan, puedes:
1. Desplegarlas manualmente desde el dashboard de Supabase
2. O esperar a tener los permisos correctos en el CLI

## 📋 Estado Actual

✅ **MCP configurado correctamente:**
- `supabase_gtiq` → `fyyhkdishlythkdnojdh` ✅
- `supabase_zonacliente` → `wpzvruwcxtgshmwcqjsa` ✅ (NO TOCADO)

✅ **Funciones desplegadas vía MCP (8):**
- clock
- list-invites
- list-people
- update-person
- delete-person
- reactivate-person
- revoke-invite
- create-invite

⏳ **Funciones admin pendientes (13):**
- Requieren permisos de CLI o despliegue manual

## 🚀 Siguiente Paso

Ejecuta:
```bash
supabase projects list
```

Y comparte el resultado para ver qué proyectos tienes disponibles y decidir la mejor opción.

