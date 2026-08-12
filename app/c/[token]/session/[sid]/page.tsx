import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { StudentSubmit } from "./student-submit"
import { PresentationViewer } from "@/components/presentation-viewer"

export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ token: string; sid: string }>
}) {
  const { token, sid } = await params
  const supabase = await createClient()

  const { data: cls } = await supabase.from("classes").select("*").eq("share_token", token).single()
  if (!cls) notFound()

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sid)
    .eq("class_id", cls.id)
    .single()
  if (!session) notFound()

  const { data: presentation } = await supabase
    .from("presentations")
    .select("id")
    .eq("session_id", sid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (session.kind === "group") {
    const [{ data: groups }, { data: groupStudents }] = await Promise.all([
      supabase.from("session_groups").select("*").eq("session_id", sid).order("group_number"),
      // Chỉ cần students khi phiên "chia lại nhóm" để HS tự nhận dạng
      session.use_fixed_groups
        ? Promise.resolve({ data: [] as any[] })
        : supabase.from("students").select("*").eq("class_id", cls.id).order("slot_number"),
    ])

    return (
      <PresentationViewer
        presentationId={presentation?.id ?? ""}
        sessionId={sid}
        isTeacher={false}
        groupCount={groups?.length ?? 0}
        submissions={[]}
      >
      <StudentSubmit
        kind="group"
        classId={cls.id}
        className={cls.name}
        session={session}
        groups={groups ?? []}
        slots={[]}
        students={(groupStudents ?? []) as any}
        shareToken={token}
      />
      </PresentationViewer>
    )
  }

  const { data: slots } = await supabase
    .from("session_slots")
    .select("*")
    .eq("session_id", sid)
    .order("slot_number")

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", cls.id)
    .order("slot_number")

  return (
    <StudentSubmit
      kind="individual"
      classId={cls.id}
      className={cls.name}
      session={session}
      groups={[]}
      slots={slots ?? []}
      students={students ?? []}
      shareToken={token}
    />
  )
}
