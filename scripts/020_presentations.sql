-- Presentations table
create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  slide_count int not null default 0,
  current_slide int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presentations_session_id_idx on public.presentations(session_id);
create index if not exists presentations_teacher_id_idx on public.presentations(teacher_id);

-- Presentation slides metadata
create table if not exists public.presentation_slides (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  slide_number int not null,
  image_path text not null,
  created_at timestamptz not null default now(),
  unique(presentation_id, slide_number)
);

create index if not exists presentation_slides_presentation_id_idx on public.presentation_slides(presentation_id);
