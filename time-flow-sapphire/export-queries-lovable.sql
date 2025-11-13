-- ============================================
-- QUERIES PARA EXPORTAR DATOS DESDE LOVABLE CLOUD
-- ============================================
-- Ejecuta estas queries en el SQL Editor de Lovable Cloud
-- Copia los resultados y guárdalos en archivos separados
-- ============================================

-- ============================================
-- 1. EXPORTAR PROFILES
-- ============================================
-- Ejecuta esto y copia los resultados
SELECT 
  'INSERT INTO public.profiles (id, email, full_name, avatar_url, center_id, team_id, is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(email) || ', ' ||
  COALESCE(quote_literal(full_name), 'NULL') || ', ' ||
  COALESCE(quote_literal(avatar_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(center_id::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(team_id::text), 'NULL') || ', ' ||
  is_active || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  quote_literal(updated_at::text) || ');' AS insert_statement
FROM public.profiles
ORDER BY created_at;

-- ============================================
-- 2. EXPORTAR COMPANIES
-- ============================================
SELECT 
  'INSERT INTO public.companies (id, name, owner_user_id, plan, status, policies, created_at, updated_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(owner_user_id::text), 'NULL') || ', ' ||
  quote_literal(plan) || ', ' ||
  COALESCE(quote_literal(status), 'NULL') || ', ' ||
  COALESCE(quote_literal(policies::text), '''{}''') || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  quote_literal(updated_at::text) || ');' AS insert_statement
FROM public.companies
ORDER BY created_at;

-- ============================================
-- 3. EXPORTAR MEMBERSHIPS
-- ============================================
SELECT 
  'INSERT INTO public.memberships (id, user_id, company_id, role, created_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(user_id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  quote_literal(role::text) || ', ' ||
  quote_literal(created_at::text) || ');' AS insert_statement
FROM public.memberships
ORDER BY created_at;

-- ============================================
-- 4. EXPORTAR CENTERS
-- ============================================
SELECT 
  'INSERT INTO public.centers (id, company_id, name, address, geojson, created_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(address), 'NULL') || ', ' ||
  COALESCE(quote_literal(geojson::text), 'NULL') || ', ' ||
  quote_literal(created_at::text) || ');' AS insert_statement
FROM public.centers
ORDER BY created_at;

-- ============================================
-- 5. EXPORTAR TEAMS
-- ============================================
SELECT 
  'INSERT INTO public.teams (id, company_id, name, center_id, created_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  quote_literal(name) || ', ' ||
  COALESCE(quote_literal(center_id::text), 'NULL') || ', ' ||
  quote_literal(created_at::text) || ');' AS insert_statement
FROM public.teams
ORDER BY created_at;

-- ============================================
-- 6. EXPORTAR INVITES
-- ============================================
SELECT 
  'INSERT INTO public.invites (id, company_id, email, role, token, status, center_id, team_id, created_by, created_at, expires_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  quote_literal(email) || ', ' ||
  quote_literal(role) || ', ' ||
  quote_literal(token) || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(center_id::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(team_id::text), 'NULL') || ', ' ||
  quote_literal(created_by::text) || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  quote_literal(expires_at::text) || ');' AS insert_statement
FROM public.invites
ORDER BY created_at;

-- ============================================
-- 7. EXPORTAR DEVICES
-- ============================================
SELECT 
  'INSERT INTO public.devices (id, company_id, center_id, name, type, secret_hash, meta, last_seen_at, created_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  COALESCE(quote_literal(center_id::text), 'NULL') || ', ' ||
  quote_literal(name) || ', ' ||
  quote_literal(type) || ', ' ||
  COALESCE(quote_literal(secret_hash), 'NULL') || ', ' ||
  COALESCE(quote_literal(meta::text), '''{}''') || ', ' ||
  COALESCE(quote_literal(last_seen_at::text), 'NULL') || ', ' ||
  quote_literal(created_at::text) || ');' AS insert_statement
FROM public.devices
ORDER BY created_at;

-- ============================================
-- 8. EXPORTAR TIME_EVENTS
-- ============================================
SELECT 
  'INSERT INTO public.time_events (id, company_id, user_id, device_id, event_type, event_time, latitude, longitude, photo_url, notes, source, meta, created_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  quote_literal(user_id::text) || ', ' ||
  COALESCE(quote_literal(device_id::text), 'NULL') || ', ' ||
  quote_literal(event_type::text) || ', ' ||
  quote_literal(event_time::text) || ', ' ||
  COALESCE(latitude::text, 'NULL') || ', ' ||
  COALESCE(longitude::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(photo_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(notes), 'NULL') || ', ' ||
  COALESCE(quote_literal(source), 'NULL') || ', ' ||
  COALESCE(quote_literal(meta::text), '''{}''') || ', ' ||
  quote_literal(created_at::text) || ');' AS insert_statement
FROM public.time_events
ORDER BY created_at;

-- ============================================
-- 9. EXPORTAR WORK_SESSIONS
-- ============================================
SELECT 
  'INSERT INTO public.work_sessions (id, company_id, user_id, clock_in_time, clock_out_time, total_work_duration, total_pause_duration, status, is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  quote_literal(user_id::text) || ', ' ||
  quote_literal(clock_in_time::text) || ', ' ||
  COALESCE(quote_literal(clock_out_time::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(total_work_duration::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(total_pause_duration::text), '''0''') || ', ' ||
  COALESCE(quote_literal(status), '''open''') || ', ' ||
  COALESCE(is_active::text, 'true') || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  quote_literal(updated_at::text) || ');' AS insert_statement
FROM public.work_sessions
ORDER BY created_at;

-- ============================================
-- 10. EXPORTAR ABSENCES
-- ============================================
SELECT 
  'INSERT INTO public.absences (id, company_id, user_id, created_by, absence_type, start_date, end_date, reason, status, approved_by, approved_at, created_at, updated_at) VALUES (' ||
  quote_literal(id::text) || ', ' ||
  quote_literal(company_id::text) || ', ' ||
  quote_literal(user_id::text) || ', ' ||
  quote_literal(created_by::text) || ', ' ||
  quote_literal(absence_type::text) || ', ' ||
  quote_literal(start_date::text) || ', ' ||
  quote_literal(end_date::text) || ', ' ||
  COALESCE(quote_literal(reason), 'NULL') || ', ' ||
  quote_literal(status) || ', ' ||
  COALESCE(quote_literal(approved_by::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(approved_at::text), 'NULL') || ', ' ||
  quote_literal(created_at::text) || ', ' ||
  quote_literal(updated_at::text) || ');' AS insert_statement
FROM public.absences
ORDER BY created_at;

-- ============================================
-- 11. EXPORTAR SUPERADMINS
-- ============================================
SELECT 
  'INSERT INTO public.superadmins (user_id, created_at) VALUES (' ||
  quote_literal(user_id::text) || ', ' ||
  COALESCE(quote_literal(created_at::text), 'now()') || ');' AS insert_statement
FROM public.superadmins;

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Ejecuta cada query en el SQL Editor de Lovable Cloud
-- 2. Copia todos los resultados (INSERT statements)
-- 3. Guárdalos en un archivo llamado: lovable-data.sql
-- 4. Para usuarios de auth, necesitarás exportarlos de otra forma
--    (Lovable Cloud debería tener una opción para exportar usuarios)
-- ============================================

