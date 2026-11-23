-- Simple manual rewatch counters (additive).
-- Separate from watch_periods/watch_activities: no dates, no /watching history, no social feed.
-- season_number IS NULL  => movie rewatch counter, or whole-TV-show rewatch counter
-- season_number >= 1     => TV season rewatch counter

create table if not exists public.manual_rewatch_counts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  season_number int null check (season_number is null or season_number >= 1),
  count int not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_rewatch_counts_user_media_season_uniq
    unique (user_id, media_id, season_number)
);

-- Enforce uniqueness when season_number is NULL (Postgres unique treats NULLs as distinct).
create unique index if not exists manual_rewatch_counts_user_media_whole_uniq
  on public.manual_rewatch_counts (user_id, media_id)
  where season_number is null;

create index if not exists manual_rewatch_counts_user_media_idx
  on public.manual_rewatch_counts (user_id, media_id);

alter table public.manual_rewatch_counts enable row level security;

-- Visible to authenticated users so another user's detailed card/entry can show totals.
create policy "Manual rewatch counts are viewable by authenticated users"
  on public.manual_rewatch_counts for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own manual rewatch counts"
  on public.manual_rewatch_counts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own manual rewatch counts"
  on public.manual_rewatch_counts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own manual rewatch counts"
  on public.manual_rewatch_counts for delete
  using (auth.uid() = user_id);

create or replace trigger on_manual_rewatch_count_updated
  before update on public.manual_rewatch_counts
  for each row execute function public.handle_updated_at();

grant select, insert, update, delete on public.manual_rewatch_counts to authenticated;
grant all on public.manual_rewatch_counts to service_role;
