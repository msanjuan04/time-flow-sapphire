-- Ensure the superadmin email has full access across companies
-- Idempotent: only updates existing user/profile and avoids duplicate inserts

-- Mark profile as superadmin if the user exists
update profiles
set is_superadmin = true,
    is_active = coalesce(is_active, true)
where email = 'gnerai@gneraitiq.com';

-- Mirror in legacy superadmins table if the user exists there
insert into superadmins (user_id)
select id
from profiles
where email = 'gnerai@gneraitiq.com'
on conflict (user_id) do nothing;

