-- Gói sử dụng của giáo viên (free / pro / school)
-- Chạy trong Supabase SQL Editor trước khi deploy code mới.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'school')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_public_all on public.profiles;
create policy profiles_public_all on public.profiles for all using (true) with check (true);
