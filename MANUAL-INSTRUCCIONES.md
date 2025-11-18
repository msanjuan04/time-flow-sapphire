# 📘 Manual de Instrucciones - Sistema de Control Horario GTiQ

## 🎯 Índice

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Rol: Owner/Administrador](#rol-owneradministrador)
4. [Rol: Worker (Trabajador)](#rol-worker-trabajador)
5. [Funciones Avanzadas](#funciones-avanzadas)
6. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## 📖 Introducción

**GTiQ** es un sistema de control horario que permite gestionar los fichajes de empleados de forma digital, con seguimiento en tiempo real, reportes y gestión de ausencias.

### Características principales:
- ✅ Fichaje digital con geolocalización
- ✅ Dashboard en tiempo real
- ✅ Gestión de ausencias y horarios
- ✅ Reportes y estadísticas
- ✅ Multi-empresa
- ✅ Notificaciones automáticas

---

## 🔐 Acceso al Sistema

### Paso 1: Iniciar Sesión
1. Abre el navegador y accede a la URL del sistema
2. En la pantalla de login, ingresa tu **código de 6 dígitos**
3. El sistema te identificará automáticamente según tu rol

### Paso 2: Seleccionar Empresa (si aplica)
- Si trabajas en múltiples empresas, selecciona la empresa activa desde el selector en la parte superior

---

## 👔 Rol: Owner/Administrador

### 🏠 Dashboard Principal

**Ubicación:** Pantalla principal al iniciar sesión

**Funcionalidades:**
- **Métricas en tiempo real:**
  - Trabajadores activos actualmente
  - Fichajes del día
  - Incidencias pendientes
  - Horas trabajadas (hoy y esta semana)

- **Gráficos:**
  - Horas trabajadas en la última semana (gráfico de barras)
  - Fichajes de la última semana (gráfico de líneas)

- **Fichajes recientes:**
  - Lista de los últimos fichajes con nombre, tipo y hora

- **Resumen semanal:**
  - Horas totales de la semana
  - Total de fichajes
  - Trabajadores activos
  - Incidencias pendientes

**Acciones rápidas desde el Dashboard:**
- 📅 **Calendario** - Gestionar horarios y ausencias
- 👥 **Personas** - Gestionar empleados
- 📊 **Reportes** - Ver estadísticas detalladas
- ⚠️ **Incidencias** - Revisar problemas de fichaje
- 📱 **Dispositivos** - Gestionar tablets/dispositivos
- 🔔 **Notificaciones** - Ver alertas

---

### 📅 Calendario de Equipo

**Ubicación:** Botón "Calendario" en el Dashboard o `/manager-calendar`

**Funcionalidades principales:**

#### 1. Vista de Empleados (Columna Izquierda)
- Lista de todos los empleados de la empresa
- Buscador para filtrar empleados
- Selecciona un empleado para ver su calendario

#### 2. Calendario Mensual (Columna Central)
- **Visualización:**
  - Mes y año actual
  - Día seleccionado destacado
  - Indicadores visuales:
    - 🔵 **Punto azul** = Día con fichajes
    - 🔴 **Punto rojo** = Ausencia registrada
    - ⚪ **Punto gris** = Horas programadas

- **Navegación:**
  - Flechas izquierda/derecha para cambiar de mes
  - Click en cualquier día para seleccionarlo

#### 3. Resumen Rápido (Debajo del Calendario)
- **Estado por trabajador del día seleccionado:**
  - Nombre y email del empleado
  - Estado: "Sin actividad", "Ha fichado", "Día completo", "Faltan horas", "Ausencia aprobada"
  - Horas programadas vs registradas
  - Botones rápidos: "Programar" y "Ausencia"

#### 4. Gestión del Día Seleccionado (Columna Derecha)
- **Añadir eventos manualmente:**
  1. Selecciona un empleado y un día
  2. Elige tipo de evento: Entrada, Salida, Inicio pausa, Fin pausa
  3. Ingresa la hora
  4. Click en "Añadir"

- **Eventos del día:**
  - Lista de todos los eventos registrados
  - Opciones: Editar o Eliminar cada evento

- **Otras acciones:**
  - Marcar festivo de empresa

#### 5. Acciones Rápidas (Barra Superior)
- **Programar Horas:**
  1. Click en "Programar Horas"
  2. Selecciona fecha
  3. Ingresa horas esperadas (ej: 8)
  4. Añade notas opcionales
  5. Guarda

- **Registrar Ausencia:**
  1. Click en "Registrar Ausencia"
  2. Selecciona tipo: Vacaciones, Baja médica, Personal, Otro
  3. Define fecha inicio y fin
  4. Añade motivo (opcional)
  5. Guarda

- **Marcar Festivo de Empresa:**
  - Crea ausencias automáticas para todos los empleados en una fecha específica

#### 6. Programación Rápida
- **Asignar 8h estándar:** Botón rápido para jornada completa
- **Configurar jornada completa:** Personaliza horas y nota

---

### 👥 Gestión de Personas

**Ubicación:** Botón "Personas" o `/people`

**Funcionalidades:**

#### Ver Empleados
- Lista completa de empleados
- Información mostrada:
  - Nombre completo
  - Email
  - Rol (Owner, Admin, Manager, Worker)
  - Estado (Activo/Inactivo)
  - Último fichaje

#### Invitar Nuevo Empleado
1. Click en "Invitar Empleado"
2. Completa el formulario:
   - Email del empleado
   - Nombre completo
   - Rol a asignar
3. Click en "Enviar Invitación"
4. El empleado recibirá un email con instrucciones

#### Gestionar Empleados
- **Editar:** Modificar nombre, email, rol
- **Desactivar:** Suspender acceso temporalmente
- **Eliminar:** Remover de la empresa (cuidado: acción permanente)

#### Invitaciones Pendientes
- Ver invitaciones enviadas
- Reenviar invitación
- Revocar invitación

---

### 📊 Reportes

**Ubicación:** Botón "Reportes" o `/reports`

**Tipos de reportes disponibles:**

1. **Reporte por Empleado:**
   - Selecciona empleado
   - Define rango de fechas
   - Genera reporte con:
     - Horas trabajadas
     - Fichajes realizados
     - Ausencias
     - Incidencias

2. **Reporte de Equipo:**
   - Todos los empleados
   - Rango de fechas
   - Resumen general

3. **Exportar:**
   - PDF para impresión
   - Excel para análisis

---

### ⚠️ Incidencias

**Ubicación:** Botón "Incidencias" o `/incidents`

**Tipos de incidencias:**
- Fichaje sin salida (empleado no cerró sesión)
- Fichaje duplicado
- Fichaje fuera de horario
- Otros problemas

**Acciones:**
- Ver detalles de la incidencia
- Resolver manualmente
- Notificar al empleado

---

### 🔔 Notificaciones

**Ubicación:** Icono de campana en la barra superior

**Tipos:**
- Nuevos fichajes
- Incidencias detectadas
- Solicitudes de corrección
- Invitaciones aceptadas

---

### 📱 Dispositivos

**Ubicación:** Botón "Dispositivos" o `/devices`

**Funcionalidades:**
- Registrar tablets/dispositivos para kiosco
- Gestionar dispositivos activos
- Ver historial de uso

---

### 🔧 Solicitudes de Corrección

**Ubicación:** Botón con icono de alerta o `/correction-requests`

**Funcionalidades:**
- Ver solicitudes de empleados para corregir fichajes
- Aprobar o rechazar solicitudes
- Ver justificación del empleado

---

## 👷 Rol: Worker (Trabajador)

### ⏰ Fichaje Principal

**Ubicación:** Pantalla principal al iniciar sesión o `/me/clock`

**Funcionalidades:**

#### Estado Actual
- **Indicador visual:**
  - 🔴 **Rojo** = Fuera (no has fichado entrada)
  - 🟢 **Verde** = Trabajando (entrada registrada)
  - 🟡 **Amarillo** = En pausa

- **Información mostrada:**
  - Hora actual
  - Estado: "Fuera", "Trabajando", "En pausa"
  - Hora de entrada (si estás trabajando)
  - Tiempo transcurrido desde la entrada

#### Botones de Fichaje

1. **🟢 Entrada (Clock In):**
   - Click cuando llegues al trabajo
   - El sistema registra:
     - Hora exacta
     - Ubicación GPS (si está habilitada)
   - Aparece confirmación: "✓ Entrada registrada"

2. **☕ Iniciar Pausa:**
   - Click cuando vayas a tomar un descanso
   - El tiempo de pausa no cuenta para horas trabajadas
   - Aparece confirmación: "☕ Pausa iniciada"

3. **✓ Finalizar Pausa:**
   - Click cuando regreses del descanso
   - Continúa contando el tiempo trabajado
   - Aparece confirmación: "✓ Pausa finalizada"

4. **🔴 Salida (Clock Out):**
   - Click cuando termines tu jornada
   - El sistema registra:
     - Hora exacta
     - Total de horas trabajadas
     - Ubicación GPS
   - Aparece confirmación: "✓ Salida registrada"

#### Ubicación GPS
- El sistema intenta obtener tu ubicación automáticamente
- Si no puede obtenerla, te mostrará una advertencia
- El fichaje se guarda igual, pero sin coordenadas

#### Modo Offline
- Si no hay internet, verás un mensaje de error
- El sistema guardará el fichaje cuando recuperes conexión
- No cierres la página hasta que se confirme

---

### 📜 Historial de Fichajes

**Ubicación:** Botón "Mi Historial" o `/me/history`

**Funcionalidades:**

#### Vista de Calendario
- Calendario mensual con tus fichajes
- **Indicadores:**
  - 🔵 Día con fichajes registrados
  - 🔴 Día con ausencia
  - ⚪ Día con horas programadas

#### Detalles del Día
- Click en un día para ver:
  - Horas programadas
  - Horas trabajadas
  - Eventos del día (entrada, salida, pausas)
  - Ausencia (si aplica)

#### Solicitar Corrección
Si detectas un error en tu fichaje:

1. Ve a "Mi Historial"
2. Selecciona el día con el error
3. Click en "Solicitar Corrección"
4. Completa el formulario:
   - Tipo de corrección
   - Fecha y hora correcta
   - Justificación
5. Envía la solicitud
6. Tu supervisor la revisará

---

### 📅 Mi Calendario

**Ubicación:** Botón "Calendario" o `/calendar`

**Funcionalidades:**
- Ver tus fichajes del mes
- Ver ausencias aprobadas
- Ver horas programadas
- Ver resumen diario

---

### 📊 Mis Reportes

**Ubicación:** Botón "Mis Reportes" o `/worker-reports`

**Funcionalidades:**
- Ver tus horas trabajadas
- Ver estadísticas personales
- Exportar tus datos

---

## 🚀 Funciones Avanzadas

### Para Owners/Admins:

#### 1. Gestión de Empresas
- Crear nuevas empresas
- Cambiar entre empresas
- Configurar datos de empresa

#### 2. Impersonación
- Ver el sistema como otro usuario
- Útil para resolver problemas
- Banner visible durante impersonación

#### 3. Configuración de Planes
- Ver límites del plan actual
- Gestionar suscripción

#### 4. Logs del Sistema
- Ver actividad del sistema
- Depurar problemas
- Auditoría

---

## ❓ Preguntas Frecuentes

### Para Workers:

**P: ¿Qué pasa si olvido fichar la salida?**
R: El sistema detectará la incidencia y tu supervisor será notificado. Puedes solicitar una corrección.

**P: ¿Puedo fichar desde casa?**
R: Sí, pero el sistema registrará tu ubicación GPS. Si no estás en el lugar de trabajo, tu supervisor puede revisarlo.

**P: ¿Qué pasa si no tengo internet?**
R: El sistema guardará tu fichaje localmente y lo enviará cuando recuperes conexión. No cierres la página.

**P: ¿Puedo corregir un fichaje erróneo?**
R: Sí, ve a "Mi Historial", selecciona el día y solicita una corrección. Tu supervisor la revisará.

**P: ¿Cómo veo cuántas horas he trabajado?**
R: Ve a "Mi Historial" o "Mis Reportes" para ver tus horas trabajadas y estadísticas.

---

### Para Owners/Admins:

**P: ¿Cómo invito a un nuevo empleado?**
R: Ve a "Personas" → "Invitar Empleado" → Completa el formulario → Envía la invitación.

**P: ¿Cómo programo horarios para mis empleados?**
R: Ve a "Calendario" → Selecciona empleado y día → Click en "Programar Horas" → Define las horas.

**P: ¿Cómo veo quién está trabajando ahora?**
R: En el Dashboard principal, verás "Trabajadores activos" en tiempo real.

**P: ¿Qué hago con una incidencia?**
R: Ve a "Incidencias" → Revisa los detalles → Resuelve manualmente o notifica al empleado.

**P: ¿Cómo exporto reportes?**
R: Ve a "Reportes" → Selecciona tipo y rango → Click en "Exportar PDF" o "Exportar Excel".

**P: ¿Puedo cambiar el rol de un empleado?**
R: Sí, ve a "Personas" → Click en "Editar" del empleado → Cambia el rol → Guarda.

---

## 🎨 Consejos de Uso

### Para Workers:
- ✅ Ficha siempre al llegar y al salir
- ✅ Usa las pausas para descansos
- ✅ Revisa tu historial regularmente
- ✅ Solicita correcciones si detectas errores
- ✅ Mantén el GPS habilitado para mejor precisión

### Para Owners/Admins:
- ✅ Revisa el Dashboard diariamente
- ✅ Programa horarios con anticipación
- ✅ Resuelve incidencias rápidamente
- ✅ Revisa solicitudes de corrección
- ✅ Exporta reportes mensualmente para contabilidad

---

## 📞 Soporte

Si tienes problemas o preguntas:
1. Revisa este manual
2. Contacta a tu supervisor/administrador
3. Revisa las notificaciones del sistema

---

**Versión del Manual:** 1.0  
**Última actualización:** 2025

