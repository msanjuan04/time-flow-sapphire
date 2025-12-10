# 🔌 Configuración de MCP (Model Context Protocol) con Supabase

Este documento explica cómo conectar tu proyecto de Supabase al servidor MCP para que puedas interactuar con tu base de datos usando lenguaje natural en Cursor.

## 📋 Requisitos Previos

- Tener una cuenta de Supabase
- Tener acceso a tu proyecto de Supabase (ID: `fyyhkdishlythkdnojdh`)
- Tener Cursor instalado y actualizado

## 🚀 Pasos de Configuración

### 1. Archivo de Configuración Creado

Ya se ha creado el archivo `.cursor/mcp.json` con la configuración básica del servidor MCP de Supabase.

### 2. Autenticación

Cuando uses MCP por primera vez, Cursor te pedirá que inicies sesión en Supabase:

1. **Cursor abrirá automáticamente una ventana del navegador** para autenticarte
2. **Inicia sesión** con tu cuenta de Supabase
3. **Autoriza el acceso** al cliente MCP
4. Una vez autorizado, podrás usar MCP sin necesidad de tokens adicionales

> ⚠️ **Nota**: Anteriormente se requería un token de acceso personal (PAT), pero ya no es necesario con la autenticación OAuth.

### 3. Verificar la Conexión

Después de autenticarte, puedes verificar que MCP está funcionando:

1. Abre Cursor
2. Intenta hacer una pregunta sobre tu base de datos en lenguaje natural
3. Por ejemplo: "¿Cuántas tablas hay en mi base de datos?" o "Muéstrame la estructura de la tabla users"

## 🛠️ Uso de MCP con Supabase

Una vez configurado, puedes usar comandos en lenguaje natural para:

- **Consultar datos**: "Muéstrame todos los usuarios activos"
- **Explorar esquema**: "¿Qué columnas tiene la tabla sessions?"
- **Realizar cambios**: "Agrega una nueva columna a la tabla companies"
- **Analizar datos**: "¿Cuántos registros hay en la tabla clock_entries este mes?"

## 🔒 Seguridad

### ⚠️ Importante: Mejores Prácticas

1. **No uses MCP con datos de producción sensibles** sin las debidas precauciones
2. **Revisa las mejores prácticas de seguridad** de Supabase: https://supabase.com/mcp
3. **MCP está diseñado principalmente para desarrollo y pruebas**
4. **Siempre revisa los cambios** antes de aplicarlos a producción

### Configuración para Desarrollo Local

Si estás usando Supabase localmente con `supabase start`, puedes usar:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "http://localhost:54321/mcp"
    }
  }
}
```

> Nota: El servidor local tiene un subconjunto limitado de herramientas comparado con el servidor en la nube.

## 📚 Recursos Adicionales

- [Documentación oficial de Supabase MCP](https://supabase.com/mcp)
- [Mejores prácticas de seguridad](https://supabase.com/mcp)
- [Índice de servidores MCP](https://mcpindex.net/en/mcpserver/supabase-community-supabase-mcp)

## 🐛 Solución de Problemas

### El servidor MCP no se conecta

1. Verifica que tengas conexión a internet
2. Asegúrate de haber completado la autenticación OAuth
3. Reinicia Cursor después de configurar MCP

### No puedo autenticarme

1. Verifica que tengas una cuenta de Supabase válida
2. Asegúrate de tener permisos en el proyecto
3. Intenta cerrar y abrir Cursor nuevamente

### Los comandos no funcionan

1. Verifica que el archivo `.cursor/mcp.json` esté en la raíz del proyecto
2. Asegúrate de que la URL del servidor sea correcta
3. Revisa la consola de Cursor para ver errores

## 📝 Información del Proyecto

- **Project ID**: `fyyhkdishlythkdnojdh`
- **Supabase URL**: `https://fyyhkdishlythkdnojdh.supabase.co`
- **Servidor MCP**: `https://mcp.supabase.com/mcp`

---

✅ **Configuración completada**. Ya puedes usar MCP para interactuar con tu base de datos de Supabase usando lenguaje natural en Cursor.


