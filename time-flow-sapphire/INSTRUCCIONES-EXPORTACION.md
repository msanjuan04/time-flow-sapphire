# 📦 Instrucciones para Exportar Datos desde Lovable Cloud

Como Lovable Cloud maneja Supabase internamente, necesitamos exportar los datos manualmente usando el SQL Editor de Lovable.

## 📋 Pasos para Exportar

### 1. Acceder al SQL Editor de Lovable Cloud

1. Ve a tu proyecto en Lovable Cloud
2. Busca la opción "SQL Editor" o "Database" en el menú
3. Abre el SQL Editor

### 2. Ejecutar las Queries de Exportación

1. Abre el archivo `export-queries-lovable.sql` en este proyecto
2. Copia y ejecuta **cada query** una por una en el SQL Editor de Lovable
3. Para cada query:
   - Copia todos los resultados (las filas con INSERT statements)
   - Pégalos en un archivo de texto
   - Guarda el archivo como `lovable-data.sql`

### 3. Exportar Usuarios de Auth

Los usuarios de `auth.users` no se pueden exportar con SQL normal. Tienes dos opciones:

**Opción A: Desde Lovable Cloud (si tienen la opción)**
- Busca en la configuración de Lovable si hay una opción para exportar usuarios
- O contacta al soporte de Lovable para obtener un export de usuarios

**Opción B: Exportar manualmente**
- Si tienes pocos usuarios, puedes crearlos manualmente en el nuevo proyecto
- O usar la función de importación de Supabase si Lovable te da acceso

### 4. Verificar los Datos Exportados

Una vez que tengas el archivo `lovable-data.sql`:
- Debe contener todos los INSERT statements
- Verifica que no falte ninguna tabla importante
- Guarda el archivo en: `/Users/gnerai/gtiq/time-flow-sapphire/lovable-data.sql`

## 🔄 Alternativa: Exportar desde la Interfaz de Lovable

Si Lovable Cloud tiene una opción de exportación en la interfaz:
1. Busca en Settings → Data Export o similar
2. Exporta todas las tablas como CSV o SQL
3. Convierte los CSV a INSERT statements si es necesario

## ⚠️ Importante

- **NO exportes** la tabla `auth.users` con SQL normal (usa el método de auth export)
- Asegúrate de exportar **todas** las tablas que tienen datos
- Verifica que los datos exportados sean correctos antes de importarlos

## 📝 Siguiente Paso

Una vez que tengas el archivo `lovable-data.sql` con todos los datos:
1. Avísame y procederé a importar los datos en el nuevo proyecto Supabase
2. También necesitaremos importar los usuarios de auth

