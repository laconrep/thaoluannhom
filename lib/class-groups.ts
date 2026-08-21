import { GROUP_COLORS } from "@/lib/group-colors"

export type ClassGroup = {
  id: string
  class_id?: string
  group_number: number
  label: string
  name: string
  color: string
  display_order?: number
  leader_student_id: string | null
}

// Đọc danh sách nhóm cố định của lớp, chịu được schema chưa đủ cột
// (migration 010_class_groups.sql / 060_group_leaders.sql chưa chạy):
// - query đầy đủ trước; nếu lỗi (thiếu cột) → fallback dần xuống cột tối thiểu
// - luôn trả về các trường UI cần với giá trị mặc định an toàn
export async function fetchClassGroups(
  supabase: { from: (table: "class_groups") => any },
  classId: string,
): Promise<ClassGroup[]> {
  const selectors = [
    "id, group_number, label, name, color, leader_student_id",
    "id, group_number, label, name, color",
    "id, group_number, name, color",
    "id, group_number, name",
  ]

  for (const cols of selectors) {
    const { data, error } = await supabase
      .from("class_groups")
      .select(cols)
      .eq("class_id", classId)
      .order("group_number")

    if (error || !data) continue

    return (data as ClassGroup[]).map((g, i) => ({
      id: g.id,
      group_number: g.group_number,
      label: g.label ?? `Nhóm ${g.group_number}`,
      name: g.name ?? `Nhóm ${g.group_number}`,
      color: g.color ?? GROUP_COLORS[(g.group_number - 1) % GROUP_COLORS.length]!.hex,
      display_order: g.display_order ?? g.group_number,
      leader_student_id: g.leader_student_id ?? null,
    }))
  }

  return []
}
