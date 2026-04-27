-- Admin auth consistency fix
-- Run this once in Supabase SQL Editor.

begin;

-- 1) Normalize stored emails so login/email checks are consistent.
update public.admin_users
set email = lower(trim(email))
where email is not null
  and email <> lower(trim(email));

-- 2) Soft-delete duplicate accounts by email, keeping the newest row per email.
with ranked_accounts as (
  select
    id,
    row_number() over (
      partition by lower(trim(email))
      order by created_at desc nulls last, id desc
    ) as rn
  from public.admin_users
  where email is not null
    and deleted_at is null
), duplicates as (
  select id
  from ranked_accounts
  where rn > 1
)
update public.admin_users
set
  is_active = false,
  deleted_at = now()
where id in (select id from duplicates);

-- 3) Enforce unique active email (case-insensitive).
create unique index if not exists admin_users_email_unique_active_idx
  on public.admin_users ((lower(trim(email))))
  where deleted_at is null;

commit;
