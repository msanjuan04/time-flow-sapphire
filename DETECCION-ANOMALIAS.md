# 🔍 Sistema de Detección de Anomalías

## 📋 Descripción

Sistema automático que detecta patrones sospechosos en los fichajes y envía notificaciones a los owners/admins a través de la campanita de notificaciones.

## 🎯 Funcionalidad

**Solo alerta, NO toma acciones automáticas.** El sistema detecta anomalías y notifica al owner para que revise manualmente.

## 🔎 Tipos de Anomalías Detectadas

### 1. **Fichajes Exactamente a la Misma Hora**
- **Detecta:** Empleado que ficha siempre exactamente a la misma hora (mismo segundo)
- **Ejemplo:** "Empleado X ficha siempre exactamente a las 9:00:00. Posible automatización."
- **Confianza:** 60-95% (depende de la frecuencia)

### 2. **Múltiples Empleados desde Misma Ubicación GPS**
- **Detecta:** Varios empleados fichando desde las mismas coordenadas GPS
- **Ejemplo:** "Múltiples empleados fichan desde la misma ubicación GPS. Verificar si están en el lugar correcto."
- **Confianza:** 75%

### 3. **Patrón Demasiado Perfecto**
- **Detecta:** Fichajes con variación mínima (< 2 minutos de desviación estándar)
- **Ejemplo:** "Patrón de fichajes demasiado perfecto. Ficha siempre alrededor de las 09:00 con menos de 2 minutos de variación."
- **Confianza:** 70%

### 4. **Fichajes Fuera de Horario Normal**
- **Detecta:** 30% o más de fichajes entre 22:00-6:00
- **Ejemplo:** "Fichajes frecuentes fuera de horario normal (30% o más entre 22:00-6:00). Verificar si es correcto."
- **Confianza:** 65%

### 5. **Conflicto con Ausencias**
- **Detecta:** Fichajes registrados durante períodos de ausencia aprobada
- **Ejemplo:** "Fichajes registrados durante un período de ausencia aprobada (25 Nov - 30 Nov)."
- **Confianza:** 90%

## ⚙️ Cómo Funciona

### Activación Automática

1. **Al cargar el Dashboard:**
   - Se ejecuta inmediatamente al iniciar sesión como owner/admin

2. **Cada hora:**
   - Se ejecuta automáticamente cada 60 minutos

3. **Cuando hay nuevos fichajes:**
   - Se ejecuta 5 segundos después de cada nuevo fichaje (para agrupar eventos)

### Proceso de Detección

1. Analiza los últimos 30 días de fichajes
2. Agrupa eventos por empleado
3. Detecta patrones sospechosos
4. Solo notifica si la confianza es >= 65%
5. Crea notificaciones para todos los owners/admins de la empresa

## 📱 Notificaciones

### Dónde Aparecen
- En la **campanita** 🔔 del Dashboard
- Tipo: **Warning** (amarillo)
- Título: "⚠️ Anomalía detectada: [Nombre Empleado]"
- Mensaje: Descripción de la anomalía

### Acción al Click
- Al hacer click en la notificación, te lleva a la página de "Personas"
- Filtra automáticamente al empleado en cuestión
- Puedes revisar su historial y tomar acciones manuales

## 🚀 Despliegue

### Opción 1: Desde el Dashboard de Supabase

1. Ve a: https://supabase.com/dashboard/project/[TU_PROJECT_ID]/functions
2. Click en **"Deploy a new function"**
3. Nombre: `detect-anomalies`
4. Copia el contenido de `supabase/functions/detect-anomalies/index.ts`
5. Click en **"Deploy"**

### Opción 2: Desde CLI (si tienes permisos)

```bash
cd time-flow-sapphire
supabase functions deploy detect-anomalies
```

## 🔧 Configuración

### Umbral de Confianza
- Solo se notifican anomalías con confianza >= 65%
- Puedes ajustar este valor en el código de la función

### Frecuencia de Análisis
- Actualmente: Cada hora + cuando hay nuevos fichajes
- Puedes ajustar en `AdminView.tsx`:
  ```typescript
  setInterval(detectAnomalies, 3600000); // 1 hora en ms
  ```

### Período de Análisis
- Actualmente: Últimos 30 días
- Puedes ajustar en `detect-anomalies/index.ts`:
  ```typescript
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Cambiar 30
  ```

## 📊 Ejemplos de Notificaciones

### Ejemplo 1: Fichaje Exacto
```
⚠️ Anomalía detectada: Juan Pérez
Ficha siempre exactamente a las 9:00:00. Posible automatización.
⚠️ Anomalía detectada · revisar empleado
```

### Ejemplo 2: Misma Ubicación
```
⚠️ Anomalía detectada: María García
Múltiples empleados fichan desde la misma ubicación GPS. Verificar si están en el lugar correcto.
⚠️ Anomalía detectada · revisar empleado
```

### Ejemplo 3: Conflicto con Ausencia
```
⚠️ Anomalía detectada: Ana Martínez
Fichajes registrados durante un período de ausencia aprobada (25 Nov - 30 Nov).
⚠️ Anomalía detectada · revisar empleado
```

## ⚠️ Importante

- **Solo alerta:** El sistema NO bloquea fichajes ni toma acciones automáticas
- **Revisión manual:** El owner debe revisar cada anomalía y decidir qué hacer
- **Falsos positivos:** Puede haber falsos positivos, especialmente con empleados muy puntuales
- **Privacidad:** Las notificaciones solo se envían a owners/admins, no a otros empleados

## 🐛 Troubleshooting

### No recibo notificaciones
1. Verifica que la función esté desplegada
2. Revisa la consola del navegador por errores
3. Verifica que tengas rol de owner o admin
4. Asegúrate de que haya suficientes datos (mínimo 5 fichajes por empleado)

### Demasiadas notificaciones
- Aumenta el umbral de confianza en el código
- Ajusta los criterios de detección

### No detecta anomalías obvias
- Verifica que haya suficientes datos históricos (30 días)
- Revisa los umbrales de detección
- Asegúrate de que los datos estén correctos en la base de datos

## 📝 Notas Técnicas

- La función analiza solo eventos de tipo `clock_in` para detectar patrones
- Usa análisis estadístico simple (no requiere ML complejo)
- Las coordenadas GPS se redondean a ~10 metros de precisión
- El sistema es eficiente y no afecta el rendimiento del dashboard

---

**Versión:** 1.0  
**Última actualización:** 2025

