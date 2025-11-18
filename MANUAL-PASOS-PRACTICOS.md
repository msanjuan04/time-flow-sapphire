# 📋 Manual Práctico - Pasos Exactos por Rol

## 👔 ROL: OWNER (Propietario/Administrador)

### 🔐 PASO 1: Acceso al Sistema

**¿Cómo acceder?**
1. Abre el navegador
2. Ve a la URL del sistema
3. En la pantalla de login, ingresa tu **código de 6 dígitos**
4. El sistema te identifica automáticamente como Owner
5. Si tienes múltiples empresas, selecciona la empresa activa desde el selector superior

**Resultado:** Accedes al Dashboard principal

---

### 🏢 PASO 2: Crear una Empresa (Primera vez)

**¿Cuándo hacerlo?**
- La primera vez que accedes al sistema
- Si quieres crear una nueva empresa

**Pasos exactos:**
1. Si no tienes empresa, verás una pantalla de "Onboarding"
2. Completa el formulario:
   - **Nombre de la empresa:** Escribe el nombre (máximo 100 caracteres)
3. Click en "Crear Empresa"
4. El sistema automáticamente:
   - Crea la empresa
   - Te asigna como Owner
   - Te redirige al Dashboard

**Resultado:** Empresa creada y tú eres el Owner

---

### 👥 PASO 3: Invitar Empleados a la Empresa

**¿Para qué sirve?**
- Añadir nuevos trabajadores a tu empresa
- Asignarles un rol (Admin, Manager, Worker)

**Pasos exactos:**
1. Desde el Dashboard, click en el botón **"Personas"** (o ve a `/people`)
2. En la parte superior, click en **"Invitar Empleado"** o **"Nuevo Empleado"**
3. Completa el formulario:
   - **Email:** Email del empleado (ej: `empleado@empresa.com`)
   - **Nombre completo:** Nombre y apellidos
   - **Rol:** Selecciona uno:
     - `Owner` - Control total (solo si eres superadmin)
     - `Admin` - Gestión completa
     - `Manager` - Gestión de equipo
     - `Worker` - Solo fichaje
4. Click en **"Enviar Invitación"** o **"Crear"**

**¿Qué pasa después?**
- El empleado recibe un email con instrucciones
- Aparece en "Invitaciones Pendientes"
- Puedes reenviar o revocar la invitación

**Resultado:** Empleado invitado y recibirá email

---

### 📅 PASO 4: Programar Horarios de Trabajo

**¿Para qué sirve?**
- Definir las horas que debe trabajar cada empleado
- Planificar turnos semanales
- Establecer jornadas laborales

**Pasos exactos:**

#### Opción A: Desde el Calendario (Recomendado)
1. Click en **"Calendario"** en el Dashboard (o `/manager-calendar`)
2. En la columna izquierda, **selecciona un empleado** de la lista
3. En el calendario, **click en el día** que quieres programar
4. En la columna derecha, verás "Gestión del día seleccionado"
5. Click en **"Programar Horas"**
6. Completa:
   - **Fecha:** Se rellena automáticamente con el día seleccionado
   - **Horas Esperadas:** Ingresa el número (ej: `8` para 8 horas)
   - **Notas:** Opcional (ej: "Jornada completa", "Turno mañana")
7. Click en **"Guardar"**

#### Opción B: Programación Rápida
1. Selecciona empleado y día en el calendario
2. En la sección "Programación rápida":
   - Click en **"Asignar 8h estándar"** (rápido)
   - O personaliza: ingresa horas y nota, luego **"Configurar jornada completa"**

**Resultado:** Horas programadas para ese empleado en ese día

---

### 🏖️ PASO 5: Registrar Ausencias

**¿Para qué sirve?**
- Registrar vacaciones
- Bajas médicas
- Días personales
- Festivos

**Pasos exactos:**

#### Opción A: Ausencia Individual
1. Ve a **"Calendario"** (`/manager-calendar`)
2. Selecciona el **empleado** de la lista izquierda
3. Click en el **día** del calendario
4. Click en **"Registrar Ausencia"**
5. Completa:
   - **Tipo:** Vacaciones / Baja médica / Personal / Otro
   - **Fecha Inicio:** Selecciona fecha
   - **Fecha Fin:** Selecciona fecha (puede ser el mismo día)
   - **Motivo:** Opcional (ej: "Vacaciones familiares")
6. Click en **"Registrar"**

#### Opción B: Festivo de Empresa (Todos los empleados)
1. En el Calendario, click en **"Marcar festivo de empresa"** (botón superior)
2. Se crea automáticamente una ausencia para TODOS los empleados en el día seleccionado

**Resultado:** Ausencia registrada y visible en el calendario

---

### 📊 PASO 6: Ver Dashboard y Métricas

**¿Qué puedes ver?**
- Trabajadores activos ahora mismo
- Fichajes del día
- Incidencias pendientes
- Horas trabajadas (hoy y semana)
- Gráficos de actividad
- Fichajes recientes

**Pasos exactos:**
1. El Dashboard se carga automáticamente al iniciar sesión
2. **Métricas principales:**
   - Tarjeta "Trabajadores activos" - Cuántos están trabajando ahora
   - Tarjeta "Fichajes de hoy" - Total de entradas registradas
   - Tarjeta "Incidencias pendientes" - Problemas a resolver
3. **Gráficos:**
   - "Horas trabajadas - Última semana" (gráfico de barras)
   - "Fichajes - Última semana" (gráfico de líneas)
4. **Fichajes recientes:**
   - Lista de últimos fichajes con nombre, tipo y hora
5. **Resumen semanal:**
   - Horas totales de la semana
   - Total de fichajes
   - Trabajadores activos
   - Incidencias

**Actualización:** Se actualiza automáticamente cada 60 segundos

---

### 📅 PASO 7: Usar el Calendario de Equipo

**¿Para qué sirve?**
- Ver fichajes de todos los empleados
- Gestionar horarios
- Ver ausencias
- Añadir fichajes manualmente

**Pasos exactos:**
1. Click en **"Calendario"** en el Dashboard
2. **Columna izquierda - Lista de empleados:**
   - Busca empleados con el buscador
   - Click en un empleado para seleccionarlo
3. **Columna central - Calendario:**
   - Navega con flechas ⬅️ ➡️ para cambiar mes
   - Click en un día para seleccionarlo
   - **Indicadores visuales:**
     - 🔵 Punto azul = Día con fichajes
     - 🔴 Punto rojo = Ausencia
     - ⚪ Punto gris = Horas programadas
4. **Resumen rápido (debajo del calendario):**
   - Muestra estado de hasta 8 empleados para el día seleccionado
   - Ver: nombre, estado, horas programadas vs registradas
   - Botones rápidos: "Programar" y "Ausencia"
5. **Columna derecha - Gestión del día:**
   - Si seleccionaste empleado y día, puedes:
     - Añadir eventos manualmente (entrada, salida, pausas)
     - Ver eventos del día
     - Editar o eliminar eventos
     - Marcar festivo

**Resultado:** Control completo del calendario del equipo

---

### ✏️ PASO 8: Añadir Fichajes Manualmente

**¿Cuándo hacerlo?**
- Un empleado olvidó fichar
- Corrección de errores
- Ajustes administrativos

**Pasos exactos:**
1. Ve a **"Calendario"**
2. Selecciona el **empleado** de la lista
3. Selecciona el **día** en el calendario
4. En la columna derecha "Gestión del día seleccionado":
5. Completa:
   - **Tipo de evento:** Selecciona (Entrada / Salida / Inicio pausa / Fin pausa)
   - **Hora:** Ingresa la hora (formato HH:mm, ej: `09:00`)
6. Click en **"Añadir"**
7. El evento aparece en "Eventos del día"
8. Puedes **Editar** (icono lápiz) o **Eliminar** (icono basura) cada evento

**Resultado:** Fichaje añadido manualmente

---

### 👤 PASO 9: Gestionar Empleados

**¿Qué puedes hacer?**
- Ver lista completa
- Editar información
- Desactivar/Activar
- Eliminar (con precaución)

**Pasos exactos:**

#### Ver Lista de Empleados
1. Click en **"Personas"** (`/people`)
2. Verás lista con:
   - Nombre completo
   - Email
   - Rol
   - Estado (Activo/Inactivo)
   - Último fichaje

#### Editar Empleado
1. En la lista, click en el botón **"Editar"** del empleado
2. Modifica:
   - Nombre completo
   - Email
   - Rol
3. Click en **"Guardar"**

#### Desactivar Empleado
1. Click en **"Editar"**
2. Cambia estado a "Inactivo"
3. Guarda
4. El empleado no podrá acceder pero sus datos se mantienen

#### Eliminar Empleado
1. Click en **"Eliminar"** (⚠️ acción permanente)
2. Confirma la eliminación
3. El empleado se elimina completamente

**Resultado:** Empleado gestionado según la acción

---

### 📈 PASO 10: Generar Reportes

**¿Para qué sirve?**
- Ver estadísticas detalladas
- Exportar para contabilidad
- Analizar productividad

**Pasos exactos:**
1. Click en **"Reportes"** (`/reports`)
2. Selecciona tipo de reporte:
   - **Por Empleado:** Selecciona empleado y rango de fechas
   - **De Equipo:** Todos los empleados, rango de fechas
3. Click en **"Generar Reporte"**
4. Verás:
   - Horas trabajadas
   - Fichajes realizados
   - Ausencias
   - Incidencias
5. **Exportar:**
   - Click en **"Exportar PDF"** para imprimir
   - Click en **"Exportar Excel"** para análisis

**Resultado:** Reporte generado y disponible para exportar

---

### ⚠️ PASO 11: Gestionar Incidencias

**¿Qué son las incidencias?**
- Fichaje sin salida
- Fichaje duplicado
- Fichaje fuera de horario
- Otros problemas

**Pasos exactos:**
1. Click en **"Incidencias"** (`/incidents`) o en el número de incidencias del Dashboard
2. Verás lista de incidencias pendientes
3. Para cada incidencia:
   - Click para ver **detalles**
   - **Resolver:** Marca como resuelta
   - **Notificar:** Envía notificación al empleado
4. Las incidencias resueltas se archivan

**Resultado:** Incidencias gestionadas

---

### 🔔 PASO 12: Ver Notificaciones

**Pasos exactos:**
1. Click en el **icono de campana** 🔔 en la barra superior
2. Verás lista de notificaciones:
   - Nuevos fichajes
   - Incidencias detectadas
   - Solicitudes de corrección
   - Invitaciones aceptadas
3. Click en una notificación para ver detalles
4. Las notificaciones leídas se marcan automáticamente

---

### 🔧 PASO 13: Revisar Solicitudes de Corrección

**¿Qué son?**
- Solicitudes de empleados para corregir fichajes erróneos

**Pasos exactos:**
1. Click en el botón de **"Solicitudes de corrección"** (icono de alerta) o `/correction-requests`
2. Verás lista de solicitudes pendientes
3. Para cada solicitud:
   - Ver **detalles:** Tipo, fecha, justificación del empleado
   - **Aprobar:** Acepta la corrección
   - **Rechazar:** Deniega la solicitud
4. El empleado recibe notificación del resultado

**Resultado:** Solicitudes gestionadas

---

## 👷 ROL: WORKER (Trabajador)

### 🔐 PASO 1: Acceso al Sistema

**Pasos exactos:**
1. Abre el navegador
2. Ve a la URL del sistema
3. En la pantalla de login, ingresa tu **código de 6 dígitos**
4. El sistema te identifica como Worker
5. Accedes directamente a la pantalla de fichaje

**Resultado:** Pantalla de fichaje principal

---

### 🟢 PASO 2: Fichar Entrada

**¿Cuándo hacerlo?**
- Al llegar al trabajo
- Al comenzar tu turno

**Pasos exactos:**
1. En la pantalla principal, verás un **botón grande verde "ENTRADA"**
2. Verifica que el estado muestra "Fuera del trabajo" (punto rojo)
3. Click en **"ENTRADA"**
4. El sistema:
   - Registra la hora exacta
   - Intenta obtener tu ubicación GPS
   - Muestra confirmación: "✓ Entrada registrada"
5. El estado cambia a **"Trabajando"** (punto verde)
6. Aparece:
   - Hora de entrada
   - Tiempo transcurrido (contador en vivo)

**⚠️ Importante:**
- Si no hay GPS, verás una advertencia pero el fichaje se guarda
- Si no hay internet, el fichaje se guarda localmente y se envía después

**Resultado:** Entrada registrada, estás "Trabajando"

---

### ☕ PASO 3: Iniciar Pausa

**¿Cuándo hacerlo?**
- Cuando vayas a tomar un descanso
- Cuando vayas a comer
- Cualquier pausa en tu jornada

**Pasos exactos:**
1. Debes estar en estado **"Trabajando"** (punto verde)
2. Verás el botón **"Iniciar Pausa"** (icono de café ☕)
3. Click en **"Iniciar Pausa"**
4. El sistema:
   - Pausa el contador de tiempo
   - Muestra confirmación: "☕ Pausa iniciada"
5. El estado cambia a **"En pausa"** (punto amarillo)
6. El tiempo transcurrido se detiene

**⚠️ Importante:**
- El tiempo de pausa NO cuenta para horas trabajadas
- Siempre debes finalizar la pausa antes de fichar salida

**Resultado:** Pausa iniciada, estado "En pausa"

---

### ✓ PASO 4: Finalizar Pausa

**¿Cuándo hacerlo?**
- Cuando regreses del descanso
- Cuando termines de comer

**Pasos exactos:**
1. Debes estar en estado **"En pausa"** (punto amarillo)
2. Verás el botón **"Finalizar Pausa"** (icono de check ✓)
3. Click en **"Finalizar Pausa"**
4. El sistema:
   - Reanuda el contador de tiempo
   - Muestra confirmación: "✓ Pausa finalizada"
5. El estado vuelve a **"Trabajando"** (punto verde)
6. El tiempo transcurrido continúa desde donde se pausó

**Resultado:** Pausa finalizada, vuelves a "Trabajando"

---

### 🔴 PASO 5: Fichar Salida

**¿Cuándo hacerlo?**
- Al terminar tu turno
- Al finalizar tu jornada

**Pasos exactos:**
1. Debes estar en estado **"Trabajando"** (punto verde) o **"En pausa"** (punto amarillo)
   - Si estás en pausa, primero finaliza la pausa
2. Verás el botón **"FICHAR SALIDA"** (botón rojo grande)
3. Click en **"FICHAR SALIDA"**
4. El sistema:
   - Registra la hora exacta
   - Obtiene tu ubicación GPS
   - Calcula total de horas trabajadas
   - Cierra la sesión
   - Muestra confirmación: "✓ Salida registrada"
5. El estado vuelve a **"Fuera del trabajo"** (punto rojo)
6. El contador se detiene

**⚠️ Importante:**
- NO olvides fichar la salida
- Si olvidas, se generará una incidencia y tu supervisor será notificado

**Resultado:** Salida registrada, estado "Fuera"

---

### 📜 PASO 6: Ver Mi Historial

**¿Para qué sirve?**
- Ver todos tus fichajes
- Ver tus horas trabajadas
- Ver ausencias
- Ver horas programadas

**Pasos exactos:**
1. En la pantalla principal, click en el botón **"Calendario"** o ve a `/calendar`
2. Verás un **calendario mensual**
3. **Indicadores visuales:**
   - 🔵 Día con fichajes registrados
   - 🔴 Día con ausencia
   - ⚪ Día con horas programadas
4. **Click en un día** para ver detalles:
   - Horas programadas
   - Horas trabajadas
   - Eventos del día (entrada, salida, pausas)
   - Ausencia (si aplica)
5. Navega entre meses con las flechas ⬅️ ➡️

**Resultado:** Historial completo visible

---

### ✏️ PASO 7: Solicitar Corrección de Fichaje

**¿Cuándo hacerlo?**
- Olvidaste fichar entrada o salida
- Fichaste a la hora incorrecta
- Error en el sistema

**Pasos exactos:**
1. Ve a **"Mi Historial"** (`/calendar` o `/me/history`)
2. Selecciona el **día** con el error en el calendario
3. Click en **"Solicitar Corrección"** o ve a `/correction-requests`
4. Completa el formulario:
   - **Tipo de corrección:** Selecciona (Entrada / Salida / Otro)
   - **Fecha:** Se rellena automáticamente con el día seleccionado
   - **Hora correcta:** Ingresa la hora que debería ser (formato HH:mm)
   - **Justificación:** Explica el motivo (ej: "Olvidé fichar la entrada")
5. Click en **"Enviar Solicitud"**
6. Verás confirmación: "Solicitud enviada"
7. Tu supervisor la revisará y recibirás notificación del resultado

**Resultado:** Solicitud enviada, pendiente de aprobación

---

### 📊 PASO 8: Ver Mis Reportes

**¿Para qué sirve?**
- Ver tus horas trabajadas
- Ver estadísticas personales
- Exportar tus datos

**Pasos exactos:**
1. Click en el botón **"Informes"** o ve a `/worker-reports`
2. Verás:
   - **Horas trabajadas:** Hoy, esta semana, este mes
   - **Gráficos:** Actividad por días
   - **Resumen:** Total de horas y fichajes
3. Puedes:
   - Seleccionar rango de fechas
   - Ver detalles por día
   - Exportar tus datos (si está disponible)

**Resultado:** Estadísticas personales visibles

---

### 🏖️ PASO 9: Ver Mis Ausencias

**Pasos exactos:**
1. Click en el botón **"Ausencias"** o ve a `/absences`
2. Verás lista de tus ausencias:
   - Vacaciones
   - Bajas médicas
   - Días personales
   - Festivos
3. Información mostrada:
   - Tipo de ausencia
   - Fechas (inicio y fin)
   - Estado (Aprobada / Pendiente)
   - Motivo (si hay)

**Resultado:** Ausencias visibles

---

### 🔔 PASO 10: Ver Notificaciones

**Pasos exactos:**
1. Click en el **icono de campana** 🔔 en la barra superior
2. Verás lista de notificaciones:
   - Solicitud de corrección aprobada/rechazada
   - Recordatorios
   - Otras notificaciones del sistema
3. Click en una notificación para ver detalles
4. Las notificaciones leídas se marcan automáticamente

---

## 📱 FUNCIONES ADICIONALES

### Para Owner:

#### Cambiar entre Empresas
- Si trabajas en múltiples empresas, usa el **selector de empresa** en la barra superior
- Selecciona la empresa activa
- El Dashboard se actualiza automáticamente

#### Ver Dispositivos
- Click en **"Dispositivos"** (`/devices`)
- Ver tablets/dispositivos registrados para kiosco
- Gestionar dispositivos activos

---

### Para Worker:

#### Modo Offline
- Si no hay internet, verás mensaje "Sin conexión"
- Tus fichajes se guardan localmente
- Se envían automáticamente al recuperar conexión
- **No cierres la página** hasta que se confirme el envío

#### GPS
- El sistema intenta obtener tu ubicación automáticamente
- Si no funciona, verás advertencia pero el fichaje se guarda
- Acepta permisos de ubicación en el navegador para mejor precisión

---

## ⚠️ ERRORES COMUNES Y SOLUCIONES

### Owner:

**Error: "No puedo crear empleados"**
- Verifica que tienes rol de Owner o Admin
- Revisa que la empresa esté activa
- Contacta al superadmin si persiste

**Error: "No se actualizan las métricas"**
- Refresca la página (F5)
- Verifica conexión a internet
- Espera unos segundos, se actualiza cada 60 segundos

---

### Worker:

**Error: "Ya tienes una sesión activa"**
- Debes fichar la salida primero
- Si no puedes, contacta a tu supervisor
- El supervisor puede cerrar la sesión manualmente

**Error: "No tienes una sesión abierta"**
- Debes fichar la entrada primero
- No puedes fichar salida sin haber fichado entrada

**Error: "Sin conexión a internet"**
- El fichaje se guarda localmente
- No cierres la página
- Se enviará automáticamente al recuperar conexión
- Puedes click en "Reintentar" cuando tengas internet

---

## 📞 CONTACTO Y SOPORTE

**Si tienes problemas:**
1. Revisa este manual
2. Verifica las notificaciones del sistema
3. Contacta a tu supervisor/administrador
4. Revisa las incidencias si eres Owner

---

**Versión:** 1.0  
**Última actualización:** 2025

