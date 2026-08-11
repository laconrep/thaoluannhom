# Setup PowerPoint Feature

Tính năng PowerPoint đã được tích hợp vào app. Để hoạt động đầy đủ, bạn cần hoàn thành các bước sau:

## 1. Tạo Database Tables

Chạy SQL migration dưới đây trong Supabase SQL Editor:

```sql
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
```

## 2. Tạo Storage Bucket

Trong Supabase Storage:
1. Tạo bucket mới tên: `presentations`
2. Chọn **Private** access level
3. Click Create

## 3. Set Row Level Security (RLS)

Cho bảng `presentations`:

```sql
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY presentations_select_policy ON presentations FOR SELECT
  USING (teacher_id = auth.uid() OR session_id IN (
    SELECT id FROM sessions WHERE id = session_id
  ));

CREATE POLICY presentations_insert_policy ON presentations FOR INSERT
  WITH CHECK (teacher_id = auth.uid());
```

## 4. Kiểm tra Feature

Sau khi setup:

1. Đăng nhập với tài khoản giáo viên
2. Vào một session (nhóm)
3. Kéo file PowerPoint (.pptx) vào vùng upload
4. Click "Hide" để ẩn thảo luận
5. Xem slide hiện toàn màn hình

## 5. Các tính năng

- **Upload PowerPoint**: Kéo thả hoặc click để chọn file .pptx
- **Fullscreen Display**: PowerPoint chiếm toàn màn hình
- **Slide Controls**: Nút next/previous để điều hướng
- **Real-time Sync**: Tất cả học sinh thấy slide giống nhau
- **Status Bar**: 4% thanh mỏng bên trái hiển thị 8 nhóm
- **Group Status**: Xanh = đã nộp, Đỏ = chưa nộp
- **Notifications**: Âm thanh "ding" khi nhóm nộp
- **Persistent State**: Trạng thái show/hide lưu vào localStorage

## API Endpoints

- `POST /api/presentations/upload` - Upload PowerPoint file
- `PUT /api/presentations/[id]/slide` - Cập nhật slide hiện tại

## Cấu trúc File

- `components/presentation-viewer.tsx` - Component chính hiển thị PowerPoint
- `components/presentation-upload.tsx` - Form upload
- `app/api/presentations/upload/route.ts` - API upload
- `app/api/presentations/[id]/slide/route.ts` - API cập nhật slide
- `lib/presentation-utils.ts` - Utility functions

## Troubleshooting

**Lỗi "Failed to fetch"**: 
- Kiểm tra database tables đã được tạo chưa
- Kiểm tra Supabase connection (env vars)

**Lỗi upload file**:
- Kiểm tra storage bucket "presentations" tồn tại
- Kiểm tra file là .pptx (không .ppt)

**Slide không hiển thị**:
- Kiểm tra image_path trong presentation_slides
- Kiểm tra storage bucket có ảnh slide không
