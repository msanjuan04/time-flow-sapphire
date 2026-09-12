-- =====================================================
-- Cierre mensual: lectura de las firmas desde la app
-- =====================================================
-- La tabla monthly_signoffs existía sin uso y, tras activar la seguridad por
-- filas, quedó sin acceso desde el navegador. La escritura sigue siendo solo
-- de la edge function sign-month (service role), que es quien recalcula el
-- mes y sella el hash. Aquí solo se abre la lectura:
--   - cada persona ve sus propias firmas,
--   - owner, admin y manager ven las de su empresa.

BEGIN;

GRANT SELECT ON TABLE public.monthly_signoffs TO authenticated;

DROP POLICY IF EXISTS monthly_signoffs_own_select ON public.monthly_signoffs;
CREATE POLICY monthly_signoffs_own_select ON public.monthly_signoffs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS monthly_signoffs_staff_select ON public.monthly_signoffs;
CREATE POLICY monthly_signoffs_staff_select ON public.monthly_signoffs
  FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid(), company_id) = ANY (ARRAY['owner', 'admin', 'manager']::public.user_role[])
  );

CREATE INDEX IF NOT EXISTS idx_monthly_signoffs_company_period
  ON public.monthly_signoffs (company_id, year, month);

COMMIT;
