-- ============================================================
-- SEED DE DEMO — GTiQ
-- PASO 2 de 2: Ejecutar en Supabase SQL Editor DESPUÉS del Paso 1
--
-- Paso 1: Ejecutar en SQL Editor primero:
--
--   SELECT id, email FROM auth.users WHERE email LIKE 'demo-%@gtiq.app';
--
--   Si NO existen, créalos con la Admin API (Dashboard > Authentication > Users > Add User):
--     - Email: demoowner@gneraitiq.com  / Password: DemoGTiQ2026!
--     - Email: demoworker@gneraitiq.com / Password: DemoGTiQ2026!
--
--   Luego copia los UUIDs que Supabase generó y sustituye abajo.
--
-- Paso 2: Ajusta los UUIDs en las 2 líneas marcadas ⬇️ y ejecuta este script.
-- ============================================================

DO $$
DECLARE
  -- ⬇️ SUSTITUYE estos UUIDs con los de auth.users (paso 1)
  v_owner_id     UUID := 'c00bb7b3-99fb-4003-9cd2-8ce7d4c578ec';
  v_worker_id    UUID := '179086a3-a8b6-4ec2-8e36-d36a34b3ff6e';
  -- ⬆️ ──────────────────────────────────────────────────

  v_company_id   UUID := 'a0000000-0000-4000-8000-000000000001';
  v_owner_email  TEXT := 'demoowner@gneraitiq.com';
  v_worker_email TEXT := 'demoworker@gneraitiq.com';
  v_today        DATE := CURRENT_DATE;
  v_d            DATE;
  v_i            INT;
  v_session_id   UUID;
BEGIN

  -- ================================================================
  -- 1. EMPRESA DEMO
  -- ================================================================
  INSERT INTO public.companies (id, name, status, plan, owner_user_id, created_at, updated_at)
  VALUES (
    v_company_id,
    'Demo GTiQ S.L.',
    'active',
    'pro',
    v_owner_id,
    NOW() - INTERVAL '30 days',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET name = 'Demo GTiQ S.L.', status = 'active', owner_user_id = v_owner_id;

  -- ================================================================
  -- 2. PERFILES con códigos fijos 000000 / 000001
  -- ================================================================
  -- Liberar los códigos si ya los tiene otro usuario
  UPDATE public.profiles SET login_code = public.generate_login_code()
  WHERE login_code IN ('000000', '000001') AND id NOT IN (v_owner_id, v_worker_id);

  INSERT INTO public.profiles (id, email, full_name, login_code, is_active, created_at, updated_at)
  VALUES
    (v_owner_id, v_owner_email, 'Carlos García (Demo)', '000000', TRUE, NOW(), NOW()),
    (v_worker_id, v_worker_email, 'María López (Demo)', '000001', TRUE, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    login_code = EXCLUDED.login_code,
    full_name = EXCLUDED.full_name;

  -- ================================================================
  -- 3. MEMBERSHIPS
  -- ================================================================
  -- Limpiar memberships duplicados primero
  DELETE FROM public.memberships
  WHERE company_id = v_company_id AND user_id IN (v_owner_id, v_worker_id);

  INSERT INTO public.memberships (id, user_id, company_id, role, created_at)
  VALUES
    (gen_random_uuid(), v_owner_id, v_company_id, 'owner', NOW() - INTERVAL '30 days'),
    (gen_random_uuid(), v_worker_id, v_company_id, 'worker', NOW() - INTERVAL '25 days');

  -- ================================================================
  -- 4. SCHEDULED HOURS (L-V 8h, próximas 4 semanas + historial)
  -- ================================================================
  DELETE FROM public.scheduled_hours
  WHERE user_id IN (v_owner_id, v_worker_id) AND company_id = v_company_id;

  FOR v_i IN -10..27 LOOP
    v_d := v_today + v_i;
    IF EXTRACT(ISODOW FROM v_d) BETWEEN 1 AND 5 THEN
      INSERT INTO public.scheduled_hours (user_id, company_id, date, expected_hours, start_time, end_time, notes, created_by)
      VALUES
        (v_owner_id, v_company_id, v_d, 8, '09:00:00', '17:00:00', 'Jornada estándar', v_owner_id),
        (v_worker_id, v_company_id, v_d, 8, '09:00:00', '17:00:00', 'Jornada estándar', v_owner_id)
      ON CONFLICT (user_id, date) DO NOTHING;
    END IF;
  END LOOP;

  -- ================================================================
  -- 5. WORK SESSIONS + TIME EVENTS (últimos 5 días laborables)
  -- ================================================================
  DELETE FROM public.time_events
  WHERE user_id IN (v_owner_id, v_worker_id) AND company_id = v_company_id;
  DELETE FROM public.work_sessions
  WHERE user_id IN (v_owner_id, v_worker_id) AND company_id = v_company_id;

  FOR v_d IN
    SELECT d::date FROM generate_series(v_today - INTERVAL '7 days', v_today - INTERVAL '1 day', '1 day') d
    WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
    ORDER BY d
    LIMIT 5
  LOOP
    -- Owner sessions
    v_session_id := gen_random_uuid();
    INSERT INTO public.work_sessions (id, user_id, company_id, clock_in_time, clock_out_time, is_active, total_work_duration, created_at)
    VALUES (v_session_id, v_owner_id, v_company_id,
      (v_d + TIME '08:55:00')::timestamptz, (v_d + TIME '17:08:00')::timestamptz,
      FALSE, '08:13:00', (v_d + TIME '08:55:00')::timestamptz);

    INSERT INTO public.time_events (id, user_id, company_id, event_type, event_time, source, created_at) VALUES
      (gen_random_uuid(), v_owner_id, v_company_id, 'clock_in',  (v_d + TIME '08:55:00')::timestamptz, 'web', (v_d + TIME '08:55:00')::timestamptz),
      (gen_random_uuid(), v_owner_id, v_company_id, 'clock_out', (v_d + TIME '17:08:00')::timestamptz, 'web', (v_d + TIME '17:08:00')::timestamptz);

    -- Worker sessions
    v_session_id := gen_random_uuid();
    INSERT INTO public.work_sessions (id, user_id, company_id, clock_in_time, clock_out_time, is_active, total_work_duration, created_at)
    VALUES (v_session_id, v_worker_id, v_company_id,
      (v_d + TIME '09:02:00')::timestamptz, (v_d + TIME '17:15:00')::timestamptz,
      FALSE, '08:13:00', (v_d + TIME '09:02:00')::timestamptz);

    INSERT INTO public.time_events (id, user_id, company_id, event_type, event_time, source, created_at) VALUES
      (gen_random_uuid(), v_worker_id, v_company_id, 'clock_in',  (v_d + TIME '09:02:00')::timestamptz, 'web', (v_d + TIME '09:02:00')::timestamptz),
      (gen_random_uuid(), v_worker_id, v_company_id, 'clock_out', (v_d + TIME '17:15:00')::timestamptz, 'web', (v_d + TIME '17:15:00')::timestamptz);
  END LOOP;

  -- ================================================================
  -- 6. INCIDENCIAS
  -- ================================================================
  DELETE FROM public.incidents WHERE company_id = v_company_id;

  INSERT INTO public.incidents (id, user_id, company_id, incident_type, incident_date, status, description, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_worker_id, v_company_id, 'late_arrival', v_today - 3, 'pending',
     'Llegada 12 minutos tarde por retraso en transporte público', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), v_worker_id, v_company_id, 'other', v_today - 5, 'resolved',
     'Olvidó fichar salida — se completó manualmente', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days');

  -- ================================================================
  -- 7. NOTIFICACIONES
  -- ================================================================
  DELETE FROM public.notifications WHERE user_id IN (v_owner_id, v_worker_id);

  INSERT INTO public.notifications (id, user_id, company_id, title, message, type, read, created_at)
  VALUES
    (gen_random_uuid(), v_owner_id, v_company_id,
     'Incidencia detectada', 'María López llegó tarde el ' || to_char(v_today - 3, 'DD/MM'), 'warning', FALSE, NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), v_owner_id, v_company_id,
     'Fichaje sin cierre', 'María López no registró salida el ' || to_char(v_today - 5, 'DD/MM'), 'error', TRUE, NOW() - INTERVAL '5 days'),
    (gen_random_uuid(), v_owner_id, v_company_id,
     'Nuevo empleado', 'María López se ha unido a Demo GTiQ S.L.', 'success', TRUE, NOW() - INTERVAL '25 days'),
    (gen_random_uuid(), v_worker_id, v_company_id,
     'Horario asignado', 'Tu jornada ha sido configurada: L-V 09:00-17:00', 'info', FALSE, NOW() - INTERVAL '20 days'),
    (gen_random_uuid(), v_worker_id, v_company_id,
     'Incidencia registrada', 'Se ha registrado una llegada tarde el ' || to_char(v_today - 3, 'DD/MM'), 'warning', FALSE, NOW() - INTERVAL '3 days');

  RAISE NOTICE '✅ Seed demo completado:';
  RAISE NOTICE '   Empresa: Demo GTiQ S.L.';
  RAISE NOTICE '   Owner:  Carlos García — código 000000';
  RAISE NOTICE '   Worker: María López   — código 000001';

END $$;
