# BÀN GIAO — TÍNH NĂNG NHÓM TRƯỞNG (GROUP LEADER)

> File này là tài liệu bàn giao giữa các phiên code. Mỗi phiên chỉ code **1 phần**. Cuối phiên phải cập nhật phần **TIẾN ĐỘ** và **YÊU CẦU PHIÊN SAU** để phiên sau không cần đọc lại toàn repo.

---

## MỤC TIÊU TỔNG

Thêm vai trò **nhóm trưởng** vào hệ thống phân nhóm cố định (`class_groups`):

1. Mỗi nhóm có 1 nhóm trưởng (`leader_student_id`). Nhóm trưởng phải là thành viên của chính nhóm đó.
2. GV gán/đổi/gỡ nhóm trưởng từ màn hình roster.
3. HS vào bằng link lớp: nếu là nhóm trưởng → được quyền chọn thành viên cho nhóm mình (bổ sung song song với cách phân nhóm của GV).
4. Phía GV thêm đa chọn + kéo cụm nhiều HS.
5. Cập nhật modal hướng dẫn lần đầu trên roster.

Quy tắc hệ thống giữ nguyên: **1 HS chỉ thuộc 1 nhóm/lớp** (do trigger cũ `enforce_single_class_group` đảm bảo — không đổi). Hai hình thức phân nhóm (GV + nhóm trưởng) chạy song song.

---

## KIẾN TRÚC & FILE LIÊN QUAN (BẢN ĐỒ)

| Vai trò | File | Ghi chú |
|---|---|---|
| DB schema gốc | `scripts/000_schema.sql` | `class_groups`, `class_group_members`, trigger `enforce_single_class_group` |
| DB nhóm hiện tại | `scripts/010_class_groups.sql` | Thêm trigger, RLS `cg_public_all`/`cgm_public_all`, publication realtime |
| Server actions | `app/actions.ts` | `"use server"`, gọi `createClient()` từ `@/lib/supabase/server` |
| Phía GV | `app/classes/[id]/roster/page.tsx` + `roster-view.tsx` | `RosterView` client component |
| Phía HS | `app/c/[token]/page.tsx` + `class-lobby.tsx` | `ClassLobby` client component |
| UI kit | `@/components/ui/*` | Có `Dialog`, `Button`, `Input`, `Card`, `Spinner` |
| Màu nhóm | `lib/group-colors.ts` | `groupCardStyle(color)`, `groupPillStyle(color)` |
| Supabase client | `@/lib/supabase/client` (browser) / `server` | Realtime qua `supabase.channel()` |
| CSS class | `cn()` từ `@/lib/utils` (shadcn) | |

### Type hiện tại (đang có trong code, KHÔNG được đổi tên)

```ts
// roster-view.tsx
type Student = { id: string; slot_number: number; name: string | null }
type Group = { id: string; group_number: number; label: string; name: string; color: string }

// class-lobby.tsx
type Student = { id: string; slot_number: number; name: string | null; device_token: string | null }
type Session = { id: string; title: string; kind: "group" | "individual"; status: string; started_at: string | null; ends_at: string | null; duration_seconds: number }
```

### Thông tin schema class_groups hiện tại (đã tồn tại)

```sql
class_groups: id uuid PK, class_id uuid FK→classes on delete cascade,
  group_number int, label text, name text, color text, display_order int, created_at
unique index (class_id, group_number); index (class_id, display_order)
```

`class_group_members`: PK `(class_group_id, student_id)`, FK on delete cascade 2 chiều.

### Vị trí realtime đang có

- **Roster**: `supabase.channel('class-${classId}-roster')` subscribe `students` (filter class_id), `class_groups` (filter class_id), `class_group_members` (không filter). Khi group/member đổi → gọi `refetchGroups()` / `refetchMembers()` rồi `setState`.
- **Lobby**: `supabase.channel('lobby-${classId}')` subscribe `students` (filter class_id), `sessions` (filter class_id). **Chưa** subscribe `class_groups`/`class_group_members`.

---

## PHÂN CHIA 4 PHIÊN

### PHẦN 1 — DB (phiên 1)
Tạo file **`scripts/060_group_leaders.sql`**:
- `ALTER TABLE class_groups ADD COLUMN leader_student_id uuid REFERENCES students(id) ON DELETE SET NULL`
- Unique index: 1 HS làm leader tối đa 1 nhóm/lớp → `CREATE UNIQUE INDEX ... ON class_groups(class_id, leader_student_id) WHERE leader_student_id IS NOT NULL`
- Trigger `enforce_leader_in_group()`: BEFORE INSERT OR UPDATE OF leader_student_id trên class_groups — nếu `NEW.leader_student_id` NOT NULL thì kiểm tra HS đó có trong `class_group_members` của đúng nhóm; không có → `raise exception`.
- KHÔNG cần sửa publication (class_groups đã có sẵn trong `supabase_realtime`).

### PHẦN 2 — Server actions (phiên 2)
Sửa **`app/actions.ts`**:
- `setGroupLeaderAction(groupId, leaderStudentId | null, classId)` → gán/đổi/gỡ. Khi đổi: xóa leader cũ (null) trước. Kiểm tra leader là thành viên của nhóm (trùng với trigger, phòng khi trigger chưa deploy).
- `moveStudentsToGroupAction(studentIds: string[], targetGroupId: string | null, classId)` → di chuyển nhiều HS cùng lúc; nếu HS là leader của nhóm cũ → set leader_student_id = null ở nhóm đó trước khi gỡ thành viên.
- Refactor `moveStudentToGroupAction` thành wrapper gọi `moveStudentsToGroupAction([studentId], ...)`.
- `leaderUpdateGroupMembersAction({ classId, leaderStudentId, deviceToken, targetStudentId, action: "add"|"remove" })` → không-đăng-nhập: tìm class bằng classId, đối chiếu device_token của leader trong bảng students; chỉ add HS chưa thuộc nhóm nào (đang ở nhóm khác → chặn); leader không tự gỡ mình.

### PHẦN 3 — Phía GV (phiên 3)
Sửa **`app/classes/[id]/roster/page.tsx`** + **`roster-view.tsx`**:
- `Group` type + select thêm `leader_student_id`.
- Mỗi nhóm: nút gán nhóm trưởng (dialog chọn 1 HS trong nhóm), badge 👑 (Crown) cạnh tên leader ở cột nhóm và thẻ HS trái.
- Đa chọn: Ctrl+click chọn/bỏ chọn (vành highlight), nút "Bỏ chọn", kéo thẻ đã chọn → dataTransfer mang danh sách id → thả vào nhóm → thêm tất cả (dialog xác nhận nếu có HS đang ở nhóm khác). Kéo thẻ chưa chọn giữ hành vi đơn cũ.
- Cập nhật modal hướng dẫn "Cách phân học sinh vào nhóm" (localStorage `roster_intro_seen_${classId}`) — thêm 3 mục mới.

### PHẦN 4 — Phía HS + kiểm thử (phiên 4)
Sửa **`app/c/[token]/page.tsx`** + **`class-lobby.tsx`**:
- Page load thêm `class_groups` (kèm leader_student_id, color) và `class_group_members`.
- Nếu HS là nhóm trưởng → hiện nút "Chọn thành viên cho nhóm [tên]" → màn hình danh sách cả lớp (avatar + tên + STT).
- Trạng thái realtime từng thẻ: chưa phân nhóm → click thêm vào nhóm mình; ở nhóm mình → "Nhóm em" + nút gỡ; ở nhóm khác → khóa (Lock) hiện tên nhóm, không click được.
- Subscribe realtime `class_groups` + `class_group_members` trong channel lobby hiện có.
- Chạy `pnpm exec eslint` + `pnpm exec tsc --noEmit`.

---

## TIẾN ĐỘ

- [x] **PHẦN 1 — DB** (`scripts/060_group_leaders.sql`)
- [x] **PHẦN 2 — Server actions** (`app/actions.ts`)
- [ ] **PHẦN 3 — Phía GV** (`roster-view.tsx` + `roster/page.tsx`)
- [ ] **PHẦN 4 — Phía HS + kiểm thử** (`class-lobby.tsx` + `c/[token]/page.tsx` + eslint/tsc)

> Mỗi phiên khi hoàn thành sẽ đánh dấu [x] và ghi chi tiết vào phần "Ghi chú phiên vừa rồi" + "Yêu cầu phiên sau" bên dưới.

---

## GHI CHÚ PHIÊN VỪA RỒI

### Phiên 1 — Đã hoàn thành Phần 1 (DB)
- Tạo file `scripts/060_group_leaders.sql` trên nhánh `260821-feat-code-improvements`:
  - `ALTER TABLE class_groups ADD COLUMN leader_student_id uuid REFERENCES students(id) ON DELETE SET NULL` (idempotent, có `if not exists`).
  - Index `class_groups_leader_idx` trên `leader_student_id`.
  - Unique index `class_groups_class_leader_uidx` trên `(class_id, leader_student_id)` `WHERE leader_student_id IS NOT NULL` → 1 HS chỉ làm leader tối đa 1 nhóm/lớp.
  - Function + trigger `enforce_leader_in_group` (BEFORE INSERT OR UPDATE OF leader_student_id): nếu `NEW.leader_student_id` NOT NULL thì kiểm tra tồn tại trong `class_group_members` của đúng nhóm; không có → `raise exception 'Nhóm trưởng phải là thành viên của chính nhóm đó'`. Với NULL thì bỏ qua (cho phép gỡ leader).
- KHÔNG cần sửa publication: `class_groups` đã có trong `supabase_realtime` từ `scripts/010_class_groups.sql`.
- CHƯA commit code vào nhánh tính năng.

### Phiên 2 — Đã hoàn thành Phần 2 (Server actions)
- Sửa `app/actions.ts` (trên nhánh `260821-feat-code-improvements`, CHƯA commit):
  - `moveStudentsToGroupAction(studentIds, targetGroupId|null, classId)`: di chuyển nhiều HS; **xóa `leader_student_id` của nhóm cũ TRƯỚC khi gỡ thành viên** nếu HS đó là leader.
  - `moveStudentToGroupAction` → wrapper gọi `moveStudentsToGroupAction([studentId], ...)`.
  - `setGroupLeaderAction(groupId, leaderStudentId|null, classId)`: kiểm tra leader là thành viên của nhóm; xóa leadership cũ của HS đó ở nhóm khác cùng lớp (tránh vi phạm unique index); null → gỡ leader.
  - `leaderUpdateGroupMembersAction({classId, leaderStudentId, deviceToken, targetStudentId, action})`: xác thực leader + device_token qua bảng `students`; chỉ add HS chưa thuộc nhóm nào (ở nhóm khác → chặn, "Chỉ giáo viên mới đổi được"); leader không tự gỡ mình; remove chỉ áp dụng cho thành viên trong nhóm mình.
  - Đã chạy `pnpm exec tsc --noEmit` và `pnpm exec eslint app/actions.ts` → SẠCH (exit 0).
- Ghi chú: `app/actions.ts` đã được typecheck cùng toàn bộ repo (tsc exit 0), không lỗi.

---

## YÊU CẦU PHIÊN SAU

### Phiên 3 — Phía GV (`app/classes/[id]/roster/roster-view.tsx` + `roster/page.tsx`)
Trước khi code, đọc:
- `app/classes/[id]/roster/page.tsx` (43 dòng) — server component, query class_groups + members. Đang select `class_groups: id, group_number, label, name, color`.
- `app/classes/[id]/roster/roster-view.tsx` (904 dòng) — `RosterView` client component. Đọc kỹ phần: type `Group` (dòng 56), realtime (dòng 126-189, channel `class-${classId}-roster`, `refetchGroups` select `id, group_number, label, name, color`), drag/drop đơn HS (dòng 318-356: `applyMove`, `handleDrop`), list thẻ HS (dòng 628-699), cột nhóm (dòng 717-865), modal hướng dẫn (dòng 362-420).
- `app/actions.ts` — có sẵn từ Phần 2: `setGroupLeaderAction(groupId, leaderStudentId|null, classId)`, `moveStudentsToGroupAction(studentIds[], targetGroupId|null, classId)`.

Những thứ ĐÃ CÓ sẵn (không tạo lại): `applyMove(studentId, toGroupId)` cập nhật optimistic + gọi `moveStudentToGroupAction`; `moveConfirm` dialog xác nhận đổi nhóm; `dragStudentId`, `dragOverGroupId` state; `cn()`, `groupCardStyle`, `groupPillStyle`; UI `Dialog`, `Button`, `AvatarInitials`; icon `lucide-react` (đã import nhiều icon, cần thêm `Crown`, `Check`, `Shield` nếu dùng).

Công việc cần làm:
1. `roster/page.tsx`: thêm `leader_student_id` vào select `class_groups`; truyền xuống `RosterView`.
2. `roster-view.tsx`:
   - Type `Group` thêm `leader_student_id: string | null`. `refetchGroups` thêm cột này.
   - Mỗi nhóm (cột phải, trong phần header dòng 753-786): thêm nút 👑 (dùng icon `Crown`) mở dialog chọn leader — danh sách chính là members của nhóm đó (đã có `members` biến), chọn 1 người → gọi `setGroupLeaderAction(g.id, sid, classId)`; còn nút để gỡ leader (gọi với null). Sau khi set → cập nhật optimistic `groups`.
   - Badge 👑 cạnh tên leader: trong cột nhóm (dòng ~770 tên nhóm) và trên thẻ HS bên trái (dòng ~683, chỗ pill tên nhóm).
   - Đa chọn: state `selectedStudentIds: string[]`; trên thẻ HS `onClick` với `e.ctrlKey`/`metaKey` toggle chọn + ring highlight (`ring-2 ring-primary`); nút "Bỏ chọn" xuất hiện khi có chọn; trong `onDragStart`, nếu HS đã chọn → `e.dataTransfer.setData('text/plain', JSON.stringify(selectedIds))`; trong `handleDrop`, nếu data là JSON array → gọi `moveStudentsToGroupAction(ids, gid, classId)` với dialog xác nhận khi có HS ở nhóm khác.
   - Modal hướng dẫn (dòng 362-420): thêm 3 mục (nhóm trưởng tự phân nhóm, cách gán nhóm trưởng 👑, Ctrl+click chọn nhiều).
3. Sau khi code: chạy `pnpm exec tsc --noEmit` + `pnpm exec eslint` trên 2 file này.

Lưu ý: `useTransition` có sẵn `startTransition`. Dùng `confirm()` hoặc dialog hiện có để xác nhận. Không phá vỡ hành vi kéo-thả đơn hiện tại.

