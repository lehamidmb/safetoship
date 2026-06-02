create table public.profiles (
  id uuid primary key,
  email text not null
);

alter table public.profiles enable row level security;

create policy "users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create table public.generations (
  id uuid primary key,
  user_id uuid not null,
  prompt text not null,
  response text
);

alter table public.generations enable row level security;

create policy "users can read their own generations"
on public.generations
for select
to authenticated
using (auth.uid() = user_id);
