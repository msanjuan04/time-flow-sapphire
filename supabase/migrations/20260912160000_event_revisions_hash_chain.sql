-- =====================================================
-- Histórico de cambios encadenado y verificable
-- =====================================================
-- Cada corrección o borrado de un fichaje ya se guardaba en event_revisions
-- con valor anterior, autor y motivo (11.114 movimientos), pero el campo
-- hash se insertaba vacío: la traza estaba completa y no era demostrable.
--
-- Esto la encadena: cada movimiento incluye la huella del anterior, así que
-- alterar o borrar una fila del histórico rompe la cadena desde ese punto y
-- se puede demostrar. Es lo que pide el borrador del registro horario
-- cuando habla de inmutabilidad y trazabilidad.
--
-- Todo en una transacción. El relleno recorre las 11.114 filas existentes.

BEGIN;

-- ─────────────────────────────────────────────────────
-- 1. Orden estable de la cadena
-- ─────────────────────────────────────────────────────
ALTER TABLE public.event_revisions ADD COLUMN IF NOT EXISTS seq bigint;
ALTER TABLE public.event_revisions ADD COLUMN IF NOT EXISTS prev_hash text;

WITH ordenado AS (
  SELECT id, row_number() OVER (ORDER BY changed_at, id) AS n
  FROM public.event_revisions
  WHERE seq IS NULL
)
UPDATE public.event_revisions r SET seq = o.n FROM ordenado o WHERE r.id = o.id;

CREATE SEQUENCE IF NOT EXISTS public.event_revisions_seq_seq;
SELECT setval(
  'public.event_revisions_seq_seq',
  GREATEST((SELECT coalesce(max(seq), 0) FROM public.event_revisions), 1)
);
ALTER TABLE public.event_revisions ALTER COLUMN seq SET DEFAULT nextval('public.event_revisions_seq_seq');
ALTER SEQUENCE public.event_revisions_seq_seq OWNED BY public.event_revisions.seq;
ALTER TABLE public.event_revisions ALTER COLUMN seq SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_revisions_seq ON public.event_revisions (seq);

-- ─────────────────────────────────────────────────────
-- 2. Cálculo de la huella
-- ─────────────────────────────────────────────────────
-- La fecha se normaliza a UTC con formato fijo: si se usara el texto
-- directo del timestamp, el resultado cambiaría con la zona de la sesión.
CREATE OR REPLACE FUNCTION public.event_revision_hash(
  p_seq bigint,
  p_prev text,
  p_event_id uuid,
  p_action text,
  p_previous jsonb,
  p_new jsonb,
  p_reason text,
  p_changed_by uuid,
  p_changed_at timestamptz
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(
    extensions.digest(
      coalesce(p_prev, '') || '|' ||
      p_seq::text || '|' ||
      coalesce(p_event_id::text, '') || '|' ||
      coalesce(p_action, '') || '|' ||
      coalesce(p_previous::text, '') || '|' ||
      coalesce(p_new::text, '') || '|' ||
      coalesce(p_reason, '') || '|' ||
      coalesce(p_changed_by::text, '') || '|' ||
      coalesce(to_char(p_changed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US'), ''),
      'sha256'
    ),
    'hex'
  );
$$;

-- ─────────────────────────────────────────────────────
-- 3. Rellenar la cadena con el histórico existente
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
  v_prev text := NULL;
BEGIN
  FOR r IN SELECT * FROM public.event_revisions ORDER BY seq LOOP
    UPDATE public.event_revisions
       SET prev_hash = v_prev,
           hash = public.event_revision_hash(
             r.seq, v_prev, r.event_id, r.action, r.previous_value,
             r.new_value, r.reason, r.changed_by, r.changed_at
           )
     WHERE id = r.id
    RETURNING hash INTO v_prev;
  END LOOP;
END
$$;

-- ─────────────────────────────────────────────────────
-- 4. Cada movimiento nuevo se encadena solo
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_event_revisions_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev text;
BEGIN
  -- Serializa la escritura de la cadena: dos correcciones a la vez no pueden
  -- colgar del mismo eslabón.
  PERFORM pg_advisory_xact_lock(hashtext('event_revisions_chain'));

  IF NEW.seq IS NULL THEN
    NEW.seq := nextval('public.event_revisions_seq_seq');
  END IF;
  IF NEW.changed_at IS NULL THEN
    NEW.changed_at := now();
  END IF;

  SELECT hash INTO v_prev FROM public.event_revisions ORDER BY seq DESC LIMIT 1;

  NEW.prev_hash := v_prev;
  NEW.hash := public.event_revision_hash(
    NEW.seq, v_prev, NEW.event_id, NEW.action, NEW.previous_value,
    NEW.new_value, NEW.reason, NEW.changed_by, NEW.changed_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_revisions_chain ON public.event_revisions;
CREATE TRIGGER event_revisions_chain
  BEFORE INSERT ON public.event_revisions
  FOR EACH ROW EXECUTE FUNCTION public.trg_event_revisions_chain();

-- ─────────────────────────────────────────────────────
-- 5. El histórico solo admite inserciones
-- ─────────────────────────────────────────────────────
-- Modificar o borrar una fila dejaría la cadena rota, que es justo lo que
-- se quiere detectar. La única excepción es la purga de retención, que
-- activa una marca de sesión antes de borrar.
CREATE OR REPLACE FUNCTION public.trg_event_revisions_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'El histórico de cambios no se puede modificar';
  END IF;
  IF TG_OP = 'DELETE' AND coalesce(current_setting('app.retention_purge', true), '') <> 'on' THEN
    RAISE EXCEPTION 'El histórico de cambios solo lo puede borrar la purga de retención';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS event_revisions_append_only ON public.event_revisions;
CREATE TRIGGER event_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.event_revisions
  FOR EACH ROW EXECUTE FUNCTION public.trg_event_revisions_append_only();

-- ─────────────────────────────────────────────────────
-- 6. Comprobación de la cadena
-- ─────────────────────────────────────────────────────
-- Recalcula la cadena entera y devuelve solo el veredicto y los conteos:
-- ningún dato personal, así que la puede consultar cualquier usuario con
-- sesión desde la app.
CREATE OR REPLACE FUNCTION public.verify_event_revisions_chain()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  v_prev text := NULL;
  v_checked bigint := 0;
  v_broken bigint := NULL;
BEGIN
  FOR r IN SELECT * FROM public.event_revisions ORDER BY seq LOOP
    IF r.prev_hash IS DISTINCT FROM v_prev
       OR r.hash IS DISTINCT FROM public.event_revision_hash(
            r.seq, v_prev, r.event_id, r.action, r.previous_value,
            r.new_value, r.reason, r.changed_by, r.changed_at
          )
    THEN
      v_broken := r.seq;
      EXIT;
    END IF;
    v_prev := r.hash;
    v_checked := v_checked + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', v_broken IS NULL,
    'checked', v_checked,
    'total', (SELECT count(*) FROM public.event_revisions),
    'first_broken_seq', v_broken,
    'last_hash', v_prev,
    'verified_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_event_revisions_chain() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_event_revisions_chain() TO authenticated;

COMMIT;

-- Comprobación posterior:
--   SELECT public.verify_event_revisions_chain();
--   Debe devolver ok = true y checked = total.
