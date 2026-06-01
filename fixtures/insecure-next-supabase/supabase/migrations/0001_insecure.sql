create table public.profiles (
  id uuid primary key,
  email text not null,
  plan text not null default 'free'
);

create table public.generations (
  id uuid primary key,
  user_id uuid not null,
  prompt text not null,
  response text
);

create policy "any authenticated user can read profiles"
on public.profiles
for select
to authenticated
using (auth.role() = 'authenticated');
