import { createClient } from "@/lib/supabase/server"
import { RosterView } from "./roster-view"

export default async function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cls }, { data: students }, { data: groups }, { data: members }] = await Promise.all([
    supabase.from("classes").select("id, name, capacity").eq("id", id).single(),
    supabase
      .from("students")
      .select("id, slot_number, name")
      .eq("class_id", id)
      .order("slot_number"),
    supabase
      .from("class_groups")
      .select("id, group_number, label, name, color, leader_student_id")
      .eq("class_id", id)
      .order("group_number"),
    supabase
      .from("class_group_members")
      .select("class_group_id, student_id, students!inner(class_id)")
      .eq("students.class_id", id),
  ])

  if (!cls) return null

  const memberMap: Record<string, string[]> = {}
  for (const m of (members as any[]) ?? []) {
    memberMap[m.class_group_id] ??= []
    memberMap[m.class_group_id].push(m.student_id)
  }

  return (
    <RosterView
      classId={id}
      capacity={cls.capacity}
      students={(students ?? []) as any}
      groups={(groups ?? []) as any}
      memberMap={memberMap}
    />
  )
}
