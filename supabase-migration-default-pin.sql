-- Default pinned friend + auto-follow for "rise".
-- Run ONCE in the Supabase SQL editor. Safe to re-run (all statements are
-- guarded / idempotent). Existing users who already pinned someone are skipped.

-- 1) New signups: pin + follow rise when she exists, and only while the new
--    user has no pinned friend yet.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  rise_id uuid;
  new_profile_id uuid;
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'username'
  )
  returning id into new_profile_id;

  select id into rise_id from public.profiles where username = 'rise' limit 1;

  if rise_id is not null and rise_id <> new_profile_id then
    update public.profiles
    set pinned_user_id = rise_id
    where id = new_profile_id
      and pinned_user_id is null
      and pinned_user_id_2 is null
      and pinned_user_id_3 is null;

    insert into public.follows (follower_id, following_id)
    values (new_profile_id, rise_id)
    on conflict (follower_id, following_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 2) Backfill: existing users with all three pin slots empty pin + follow rise.
--    The follows insert runs first so the "was pinless" condition still holds.
with rise as (
  select id from public.profiles where username = 'rise' limit 1
),
targets as (
  select p.id
  from public.profiles p, rise
  where p.pinned_user_id is null
    and p.pinned_user_id_2 is null
    and p.pinned_user_id_3 is null
    and p.id <> rise.id
)
insert into public.follows (follower_id, following_id)
select t.id, r.id
from targets t, rise r
on conflict (follower_id, following_id) do nothing;

with rise as (
  select id from public.profiles where username = 'rise' limit 1
)
update public.profiles p
set pinned_user_id = r.id
from rise r
where p.pinned_user_id is null
  and p.pinned_user_id_2 is null
  and p.pinned_user_id_3 is null
  and p.id <> r.id;
