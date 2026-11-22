-- Per-user hides for Upcoming Releases: hidden shows are excluded from /upcoming,
-- dashboard countdown, and upcoming release notifications.
-- Additive only.

begin;

create table if not exists public.upcoming_release_hides (
  user_id uuid not null references auth.users (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create index if not exists upcoming_release_hides_user_id_idx
  on public.upcoming_release_hides (user_id);

alter table public.upcoming_release_hides enable row level security;

drop policy if exists "Users can view their own upcoming release hides" on public.upcoming_release_hides;
create policy "Users can view their own upcoming release hides"
  on public.upcoming_release_hides for select
  using (auth.uid() = user_id);

drop policy if exists "Users can hide upcoming releases" on public.upcoming_release_hides;
create policy "Users can hide upcoming releases"
  on public.upcoming_release_hides for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unhide upcoming releases" on public.upcoming_release_hides;
create policy "Users can unhide upcoming releases"
  on public.upcoming_release_hides for delete
  using (auth.uid() = user_id);

grant all on public.upcoming_release_hides to anon, authenticated, service_role;

commit;
