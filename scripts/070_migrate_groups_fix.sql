-- ============================================================
-- MIGRATION SỬA LỖI: TẠO LỚP KHÔNG HIỆN 8 NHÓM / NÚT THÊM NHÓM KHÔNG CHẠY
-- ------------------------------------------------------------
-- Nguyên nhân: DB đang thiếu cột leader_student_id (migration
-- 060_group_leaders.sql chưa chạy) khiến các query đọc class_groups
-- bị lỗi -> roster không hiện nhóm, "Thêm nhóm" nhìn như không chạy.
--
-- CÁCH CHẠY: mở Supabase Dashboard -> SQL Editor -> dán toàn bộ
-- file này vào -> Run. File này idempotent (chạy lại nhiều lần vẫn an toàn).
-- ============================================================

-- ---------- 1. Đảm bảo bảng class_groups đủ cột ----------
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

alter table public.class_groups
  add column if not exists group_number int not null default 0;
alter table public.class_groups
  add column if not exists label text;
alter table public.class_groups
  add column if not exists name text;
alter table public.class_groups
  add column if not exists color text not null default '#0d9488';
alter table public.class_groups
  add column if not exists display_order int not null default 0;

-- ---------- 2. Cột nhóm trưởng (migration 060) ----------
alter table public.class_groups
  add column if not exists leader_student_id uuid references public.students(id) on delete set null;

create index if not exists class_groups_class_id_idx on public.class_groups(class_id, display_order);
create unique index if not exists class_groups_class_number_uidx on public.class_groups(class_id, group_number);
create index if not exists class_groups_leader_idx on public.class_groups(leader_student_id);
create unique index if not exists class_groups_class_leader_uidx
  on public.class_groups(class_id, leader_student_id)
  where leader_student_id is not null;

-- ---------- 3. Bảng thành viên nhóm ----------
create table if not exists public.class_group_members (
  class_group_id uuid not null references public.class_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (class_group_id, student_id)
);

-- ---------- 4. Trigger: 1 HS chỉ thuộc 1 nhóm/lớp ----------
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

-- ---------- 5. Trigger: nhóm trưởng phải là thành viên của nhóm ----------
create or replace function public.enforce_leader_in_group()
returns trigger
language plpgsql
as $$
declare
  v_member int;
begin
  if new.leader_student_id is null then
    return new;
  end if;

  select count(*) into v_member
  from public.class_group_members
  where class_group_id = new.id
    and student_id = new.leader_student_id;

  if v_member = 0 then
    raise exception 'Nhóm trưởng phải là thành viên của chính nhóm đó';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_class_groups_leader on public.class_groups;
create trigger trg_class_groups_leader
before insert or update of leader_student_id on public.class_groups
for each row execute function public.enforce_leader_in_group();

-- ---------- 6. RLS: cho phép đọc/ghi công khai (như ứng dụng đang dùng) ----------
alter table public.class_groups enable row level security;
alter table public.class_group_members enable row level security;

drop policy if exists cg_public_all on public.class_groups;
create policy cg_public_all on public.class_groups for all using (true) with check (true);

drop policy if exists cgm_public_all on public.class_group_members;
create policy cgm_public_all on public.class_group_members for all using (true) with check (true);

-- ---------- 7. Realtime ----------
do $$
begin
  alter publication supabase_realtime add table public.class_groups;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.class_group_members;
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- SAU KHI CHẠY XONG:
-- Lớp TẠO MỚI sẽ có 8 nhóm mặc định; nút "Thêm nhóm" hoạt động.
-- Lưu ý: các lớp tạo TRƯỚC khi chạy migration vẫn chưa có nhóm.
-- Nếu muốn lớp cũ cũng có đủ 8 nhóm, chạy thêm khối bên dưới
-- (bỏ comment để kích hoạt, chạy 1 lần duy nhất).
--
-- do $$
-- declare
--   r record;
--   i int;
-- begin
--   for r in select id from public.classes loop
--     for i in 1..8 loop
--       if not exists (
--         select 1 from public.class_groups
--         where class_id = r.id and group_number = i
--       ) then
--         insert into public.class_groups (class_id, group_number, name, color, display_order)
--         values (r.id, i, format('Nhóm %s', i), (array['#0d9488','#d97706','#2563eb','#dc2626','#7c3aed','#16a34a','#db2777','#0891b2'])[i], i);
--       end if;
--     end loop;
--   end loop;
-- end $$;
-- ============================================================
