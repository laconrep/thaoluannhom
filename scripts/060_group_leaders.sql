-- Nhóm trưởng của nhóm cố định
alter table public.class_groups
  add column if not exists leader_student_id uuid references public.students(id) on delete set null;

create index if not exists class_groups_leader_idx on public.class_groups(leader_student_id);

-- 1 HS chỉ làm nhóm trưởng tối đa 1 nhóm trong 1 lớp
create unique index if not exists class_groups_class_leader_uidx
  on public.class_groups(class_id, leader_student_id)
  where leader_student_id is not null;

-- Nhóm trưởng phải là thành viên của chính nhóm đó
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
