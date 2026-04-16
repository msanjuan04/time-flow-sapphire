# Troubleshooting: horario (scheduled_hours)

## Error 400 al guardar horario

Si al guardar un horario (pestaña "Horario simple" o similar) ves en la consola algo como:

```
scheduled_hours?on_conflict=user_id%2Cdate&columns=... 400 ()
```

### 1. Migración con `start_time` y `end_time`

La tabla `scheduled_hours` debe tener las columnas `start_time` y `end_time`. Si no se aplicó la migración que las añade, la API devuelve 400.

**Solución:** En tu proyecto Supabase, aplica la migración:

- Archivo: `supabase/migrations/20250211174000_add_schedule_times.sql`

En local (CLI):

```bash
supabase db push
# o
supabase migration up
```

Desde el dashboard de Supabase: SQL Editor → ejecuta el contenido de ese archivo (los `ALTER TABLE ... ADD COLUMN` para `scheduled_hours` y `schedule_adjustments_history`).

### 2. Sesión / created_by

El guardado requiere que haya un usuario logueado (el horario se asocia a quién lo creó). Si ves "Debes iniciar sesión para guardar el horario", inicia sesión de nuevo y vuelve a intentar.

---

## WebSocket a `ws://localhost:8081` en producción

Si en la consola del navegador (en gneraitiq.com) aparece:

```
WebSocket connection to 'ws://localhost:8081/' failed
```

- Suele ser **inofensivo**: puede venir de una extensión del navegador o de una herramienta de desarrollo, no necesariamente de esta app.
- La app en producción usa Supabase (y su URL), no localhost.
- Para que los enlaces y correos de la app apunten a producción, configura en **Supabase** (Edge Functions) el secret `SITE_URL`:

  ```bash
  supabase secrets set SITE_URL=https://gneraitiq.com --project-ref fyyhkdishlythkdnojdh
  ```

Así las funciones que generan enlaces usarán `https://gneraitiq.com` en lugar de localhost.
