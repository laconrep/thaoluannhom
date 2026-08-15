-- Nhóm cố định của lớp (dùng cho nhiều phiên thảo luận)
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

-- Nếu bảng đã tồn tại (deploy cũ thiếu cột), bổ sung cột cần thiết
alter table public.class_groups
  add column if not exists group_number int not null default 0;
alter table public.class_groups
  add column if not exists label text;

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

-- Phiên: dùng nhóm cố định hay chia lại
alter table public.sessions
  add column if not exists use_fixed_groups boolean not null default false;

-- Nhóm phiên liên kết tới class_group (khi dùng nhóm cố định)
alter table public.session_groups
  add column if not exists class_group_id uuid references public.class_groups(id) on delete set null;

-- Khi HS chia lại nhóm, mỗi nhóm phiên có danh sách thành viên (student_id)
create table if not exists public.session_group_members (
  session_group_id uuid not null references public.session_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_group_id, student_id)
);

create index if not exists session_group_members_student_idx on public.session_group_members(student_id);

-- Điểm HS: thêm cột group_name để giữ lịch sử
alter table public.student_scores
  add column if not exists group_name text;

-- RLS
alter table public.class_groups enable row level security;
alter table public.class_group_members enable row level security;
alter table public.session_group_members enable row level security;

-- Chính sách công khai như các bảng khác (giống với session_groups)
drop policy if exists cg_public_all on public.class_groups;
create policy cg_public_all on public.class_groups for all using (true) with check (true);

drop policy if exists cgm_public_all on public.class_group_members;
create policy cgm_public_all on public.class_group_members for all using (true) with check (true);

drop policy if exists sgm_public_all on public.session_group_members;
create policy sgm_public_all on public.session_group_members for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.class_groups;
alter publication supabase_realtime add table public.class_group_members;
alter publication supabase_realtime add table public.session_group_members;
