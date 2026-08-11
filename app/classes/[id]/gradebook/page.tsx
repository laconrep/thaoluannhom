import { createClient } from "@/lib/supabase/server"
import { GradebookView } from "./gradebook-view"

export default async function GradebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cls }, { data: students }, { data: sessions }, { data: scores }] =
    await Promise.all([
      supabase.from("classes").select("id, share_token").eq("id", id).single(),
      supabase
        .from("students")
        .select("id, slot_number, name")
        .eq("class_id", id)
        .order("slot_number"),
      supabase
        .from("sessions")
        .select("id, title, kind, created_at, scores_shared")
        .eq("class_id", id)
        .order("created_at"),
      supabase
        .from("student_scores")
        .select("session_id, student_id, score, students!inner(class_id)")
        .eq("students.class_id", id),
    ])

  const scoreMap: Record<string, Record<string, number | null>> = {}
  for (const row of (scores as any[]) ?? []) {
    scoreMap[row.student_id] ??= {}
    scoreMap[row.student_id][row.session_id] = row.score
  }

  return (
    <GradebookView
      classId={id}
      shareToken={cls?.share_token ?? ""}
      students={(students ?? []) as any}
      sessions={(sessions ?? []) as any}
      scoreMap={scoreMap}
    />
  )
}
