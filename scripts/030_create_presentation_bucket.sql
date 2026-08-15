-- ============================================================
-- STORAGE BUCKETS - chạy TOÀN BỘ 1 lần trong Supabase SQL Editor
-- Tạo các storage bucket mà ứng dụng sử dụng.
-- ============================================================

-- Bucket lưu file PowerPoint của giáo viên (private)
insert into storage.buckets (id, name, public)
values ('presentations', 'presentations', false)
on conflict (id) do nothing;

-- Bucket lưu bài nộp của học sinh (private)
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- Cấp quyền cho role anon/authenticated dùng signed URL (upload + download qua signed URL)
drop policy if exists presentations_storage_insert on storage.objects;
create policy presentations_storage_insert on storage.objects
  for insert with check (bucket_id = 'presentations');

drop policy if exists presentations_storage_read on storage.objects;
create policy presentations_storage_read on storage.objects
  for select using (bucket_id = 'presentations');

drop policy if exists presentations_storage_delete on storage.objects;
create policy presentations_storage_delete on storage.objects
  for delete using (bucket_id = 'presentations');

drop policy if exists submissions_storage_insert on storage.objects;
create policy submissions_storage_insert on storage.objects
  for insert with check (bucket_id = 'submissions');

drop policy if exists submissions_storage_read on storage.objects;
create policy submissions_storage_read on storage.objects
  for select using (bucket_id = 'submissions');

drop policy if exists submissions_storage_delete on storage.objects;
create policy submissions_storage_delete on storage.objects
  for delete using (bucket_id = 'submissions');
