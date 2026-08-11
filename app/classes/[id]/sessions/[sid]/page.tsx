import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { GroupSessionBoard } from "./group-board"

export default async function GroupSessionPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>
}) {
  const { id, sid } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sid)
    .eq("class_id", id)
    .single()
  if (!session || session.kind !== "group") notFound()

  const [{ data: sg }, { data: cls }, { data: subs }, { data: anns }] = await Promise.all([
    supabase
      .from("session_groups")
      .select("*")
      .eq("session_id", sid)
      .order("group_number"),
    supabase.from("classes").select("share_token, name").eq("id", id).single(),
    supabase.from("submissions").select("*").eq("session_id", sid),
    supabase.from("annotations").select("*").eq("session_id", sid),
  ])

  return (
    <GroupSessionBoard
      classId={id}
      className={cls?.name ?? ""}
      shareToken={cls?.share_token ?? ""}
      session={session as any}
      groups={(sg ?? []) as any}
      submissions={(subs ?? []) as any}
      annotations={(anns ?? []) as any}
    />
  )
}
