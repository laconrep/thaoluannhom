import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClassLobby } from "./class-lobby"

export default async function StudentLanding({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, capacity, share_token")
    .eq("share_token", token)
    .single()
  if (!cls) notFound()

  const [{ data: students }, { data: sessions }, { data: groups }, { data: members }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, slot_number, name, device_token")
        .eq("class_id", cls.id)
        .order("slot_number"),
      supabase
        .from("sessions")
        .select("id, title, kind, status, started_at, ends_at, duration_seconds, created_at")
        .eq("class_id", cls.id)
        .in("status", ["idle", "running"])
        .order("created_at", { ascending: false }),
      supabase
        .from("class_groups")
        .select("id, name, color, leader_student_id")
        .eq("class_id", cls.id)
        .order("group_number"),
      supabase
        .from("class_group_members")
        .select("class_group_id, student_id, class_groups!inner(class_id)")
        .eq("class_groups.class_id", cls.id),
    ])

  return (
    <ClassLobby
      classId={cls.id}
      className={cls.name}
      token={token}
      students={(students ?? []) as any}
      sessions={(sessions ?? []) as any}
      groups={(groups ?? []) as any}
      members={(members ?? []) as any}
    />
  )
}
