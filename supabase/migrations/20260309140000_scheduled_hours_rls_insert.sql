-- RLS scheduled_hours: quitar FOR ALL y usar políticas separadas para que INSERT funcione.
-- Borrar todas las políticas de managers que vamos a crear (por si ya se ejecutó antes).
DROP POLICY IF EXISTS "Managers can manage scheduled hours" ON public.scheduled_hours;
DROP POLICY IF EXISTS "Managers can insert scheduled hours" ON public.scheduled_hours;
DROP POLICY IF EXISTS "Managers can select scheduled hours" ON public.scheduled_hours;
DROP POLICY IF EXISTS "Managers can update scheduled hours" ON public.scheduled_hours;
DROP POLICY IF EXISTS "Managers can delete scheduled hours" ON public.scheduled_hours;

-- INSERT: managers/owners pueden crear jornadas para cualquier usuario de su empresa.
CREATE POLICY "Managers can insert scheduled hours"
ON public.scheduled_hours
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = scheduled_hours.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'manager')
  )
);

-- 3. SELECT para managers (ver filas de su empresa).
CREATE POLICY "Managers can select scheduled hours"
ON public.scheduled_hours
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = scheduled_hours.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'manager')
  )
);

-- 4. UPDATE: managers pueden actualizar filas de su empresa.
CREATE POLICY "Managers can update scheduled hours"
ON public.scheduled_hours
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = scheduled_hours.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = scheduled_hours.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'manager')
  )
);

-- 5. DELETE: managers pueden borrar filas de su empresa.
CREATE POLICY "Managers can delete scheduled hours"
ON public.scheduled_hours
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.company_id = scheduled_hours.company_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'manager')
  )
);
