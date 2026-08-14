-- Lịch sử thay đổi điểm (audit trail)
-- Chạy trong Supabase SQL Editor (hoặc qua CLI) trước khi deploy code mới.

create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  score_old numeric,
  score_new numeric,
  created_at timestamptz not null default now()
);

create index if not exists score_history_student_idx on public.score_history(student_id, session_id);
create index if not exists score_history_created_idx on public.score_history(created_at);

alter table public.score_history enable row level security;

drop policy if exists sh_public_all on public.score_history;
create policy sh_public_all on public.score_history for all using (true) with check (true);
