-- ============================================================
-- FULL SCHEMA - chạy TOÀN BỘ 1 lần trong Supabase SQL Editor
-- Dựng đủ các bảng mà ứng dụng sử dụng trên DB trống.
-- ============================================================

-- ============ LỚP HỌC ============
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  capacity int not null default 48,
  share_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_idx on public.classes(teacher_id);
create unique index if not exists classes_share_token_uidx on public.classes(share_token);

-- ============ HỌC SINH (ô trong lớp) ============
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  slot_number int not null,
  name text,
  device_token text,
  created_at timestamptz not null default now(),
  unique (class_id, slot_number)
);

create index if not exists students_class_idx on public.students(class_id);

-- ============ NHÓM CỐ ĐỊNH CỦA LỚP ============
create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  group_number int not null default 0,
  label text,
  name text not null,
  color text not null default '#0d9488',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists class_groups_class_id_idx on public.class_groups(class_id, display_order);
create unique index if not exists class_groups_class_number_uidx on public.class_groups(class_id, group_number);

-- Thành viên nhóm cố định, 1 HS chỉ thuộc 1 nhóm trong 1 lớp
create table if not exists public.class_group_members (
  class_group_id uuid not null references public.class_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (class_group_id, student_id)
);

-- Constraint: 1 HS chỉ thuộc tối đa 1 class_group
create or replace function public.enforce_single_class_group()
returns trigger
language plpgsql
as $$
declare
  v_class_id uuid;
  v_existing int;
begin
  select class_id into v_class_id from public.class_groups where id = new.class_group_id;
  select count(*) into v_existing
  from public.class_group_members m
  join public.class_groups g on g.id = m.class_group_id
  where g.class_id = v_class_id
    and m.student_id = new.student_id
    and m.class_group_id <> new.class_group_id;
  if v_existing > 0 then
    raise exception 'Học sinh đã thuộc một nhóm khác trong lớp này';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_class_group_members_single on public.class_group_members;
create trigger trg_class_group_members_single
before insert or update on public.class_group_members
for each row execute function public.enforce_single_class_group();

-- ============ PHIÊN THẢO LUẬN ============
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  kind text not null default 'group' check (kind in ('group', 'individual')),
  duration_seconds int not null default 900,
  started_at timestamptz,
  ends_at timestamptz,
  status text not null default 'idle' check (status in ('idle', 'running', 'ended')),
  scores_shared boolean not null default false,
  allow_paste boolean not null default false,
  results_shared_at timestamptz,
  allow_download boolean not null default false,
  use_fixed_groups boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sessions_class_idx on public.sessions(class_id);

-- Nhóm phiên (dùng nhóm cố định hoặc chia lại)
create table if not exists public.session_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  class_group_id uuid references public.class_groups(id) on delete set null,
  group_number int not null,
  label text not null default '',
  claimed boolean not null default false,
  claimed_at timestamptz
);

create index if not exists session_groups_session_idx on public.session_groups(session_id);

-- Thành viên nhóm phiên (chỉ dùng khi chia lại nhóm)
create table if not exists public.session_group_members (
  session_group_id uuid not null references public.session_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_group_id, student_id)
);

create index if not exists session_group_members_student_idx on public.session_group_members(student_id);

-- Ô cá nhân (phiên làm bài cá nhân)
create table if not exists public.session_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  slot_number int not null,
  student_id uuid references public.students(id) on delete set null,
  unique (session_id, slot_number)
);

create index if not exists session_slots_session_idx on public.session_slots(session_id);

-- ============ BÀI NỘP ============
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_group_id uuid references public.session_groups(id) on delete set null,
  session_slot_id uuid references public.session_slots(id) on delete set null,
  image_url text,
  text_content text,
  files jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  is_auto_submitted boolean not null default false
);

create index if not exists submissions_session_idx on public.submissions(session_id);
create index if not exists submissions_group_idx on public.submissions(session_group_id);
create index if not exists submissions_slot_idx on public.submissions(session_slot_id);

-- ============ CHẤM ĐIỂM / GHI CHÚ ============
create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_group_id uuid references public.session_groups(id) on delete set null,
  session_slot_id uuid references public.session_slots(id) on delete set null,
  data jsonb not null default '[]'::jsonb,
  score numeric,
  updated_at timestamptz not null default now()
);

create index if not exists annotations_session_idx on public.annotations(session_id);
create index if not exists annotations_group_idx on public.annotations(session_group_id);
create index if not exists annotations_slot_idx on public.annotations(session_slot_id);

create table if not exists public.student_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric,
  group_name text,
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists student_scores_session_idx on public.student_scores(session_id);

-- Lịch sử thay đổi điểm (audit trail)
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

-- ============ GÓI DÙNG CỦA GIÁO VIÊN ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'school')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ BÀI TRÌNH CHIẾU ============
create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text,
  storage_path text not null,
  slide_count int not null default 0,
  current_slide int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presentations_session_id_idx on public.presentations(session_id);
create index if not exists presentations_teacher_id_idx on public.presentations(teacher_id);

create table if not exists public.presentation_slides (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  slide_number int not null,
  image_path text not null,
  created_at timestamptz not null default now(),
  unique (presentation_id, slide_number)
);

create index if not exists presentation_slides_presentation_id_idx on public.presentation_slides(presentation_id);

-- ============ RLS ============
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_groups enable row level security;
alter table public.class_group_members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_groups enable row level security;
alter table public.session_group_members enable row level security;
alter table public.session_slots enable row level security;
alter table public.submissions enable row level security;
alter table public.annotations enable row level security;
alter table public.student_scores enable row level security;
alter table public.score_history enable row level security;
alter table public.profiles enable row level security;
alter table public.presentations enable row level security;
alter table public.presentation_slides enable row level security;

-- Chính sách công khai cho mọi bảng (ứng dụng tự kiểm tra quyền)
drop policy if exists classes_public_all on public.classes;
create policy classes_public_all on public.classes for all using (true) with check (true);

drop policy if exists students_public_all on public.students;
create policy students_public_all on public.students for all using (true) with check (true);

drop policy if exists cg_public_all on public.class_groups;
create policy cg_public_all on public.class_groups for all using (true) with check (true);

drop policy if exists cgm_public_all on public.class_group_members;
create policy cgm_public_all on public.class_group_members for all using (true) with check (true);

drop policy if exists sessions_public_all on public.sessions;
create policy sessions_public_all on public.sessions for all using (true) with check (true);

drop policy if exists session_groups_public_all on public.session_groups;
create policy session_groups_public_all on public.session_groups for all using (true) with check (true);

drop policy if exists sgm_public_all on public.session_group_members;
create policy sgm_public_all on public.session_group_members for all using (true) with check (true);

drop policy if exists session_slots_public_all on public.session_slots;
create policy session_slots_public_all on public.session_slots for all using (true) with check (true);

drop policy if exists submissions_public_all on public.submissions;
create policy submissions_public_all on public.submissions for all using (true) with check (true);

drop policy if exists annotations_public_all on public.annotations;
create policy annotations_public_all on public.annotations for all using (true) with check (true);

drop policy if exists student_scores_public_all on public.student_scores;
create policy student_scores_public_all on public.student_scores for all using (true) with check (true);

drop policy if exists sh_public_all on public.score_history;
create policy sh_public_all on public.score_history for all using (true) with check (true);

drop policy if exists profiles_public_all on public.profiles;
create policy profiles_public_all on public.profiles for all using (true) with check (true);

drop policy if exists presentations_public_all on public.presentations;
create policy presentations_public_all on public.presentations for all using (true) with check (true);

drop policy if exists presentation_slides_public_all on public.presentation_slides;
create policy presentation_slides_public_all on public.presentation_slides for all using (true) with check (true);

-- ============ REALTIME ============
alter publication supabase_realtime add table public.classes;
alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.class_groups;
alter publication supabase_realtime add table public.class_group_members;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_groups;
alter publication supabase_realtime add table public.session_group_members;
alter publication supabase_realtime add table public.session_slots;
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.annotations;
alter publication supabase_realtime add table public.student_scores;
alter publication supabase_realtime add table public.score_history;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.presentations;
alter publication supabase_realtime add table public.presentation_slides;
