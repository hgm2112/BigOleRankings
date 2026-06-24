-- Run this in your Supabase SQL editor

-- Grant API access
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- 1. Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  theme text not null default 'default',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'username'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Entries table
create table if not exists entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  year int,
  notes text default '',
  gut_rating int check (gut_rating >= 1 and gut_rating <= 100),
  gut_rated_at timestamptz,
  detailed_enjoyment int check (detailed_enjoyment >= 0 and detailed_enjoyment <= 60),
  detailed_impact int check (detailed_impact >= 0 and detailed_impact <= 20),
  detailed_recommend int check (detailed_recommend >= 0 and detailed_recommend <= 10),
  detailed_watch_again int check (detailed_watch_again >= 0 and detailed_watch_again <= 10),
  detailed_rated_at timestamptz,
  weight int not null default 0 check (weight >= 0 and weight <= 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tmdb_id, media_type)
);

alter table entries enable row level security;

create policy "Users can view their own entries"
  on entries for select
  using (auth.uid() = user_id);

-- Allow viewing other users' entries for comparison
create policy "Entries are viewable by all authenticated users"
  on entries for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own entries"
  on entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on entries for update
  using (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on entries for delete
  using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger on_entry_updated
  before update on entries
  for each row execute function public.handle_updated_at();

-- 3. Follows table
create table if not exists follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

alter table follows enable row level security;

create policy "Users can view their own follows"
  on follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);

create policy "Users can follow others"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on follows for delete
  using (auth.uid() = follower_id);

-- Add pinned_user_id to profiles
alter table profiles add column if not exists pinned_user_id uuid references profiles(id) on delete set null;
