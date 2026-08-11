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

  const [{ data: students }, { data: sessions }] = await Promise.all([
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
  ])

  return (
    <ClassLobby
      classId={cls.id}
      className={cls.name}
      token={token}
      students={(students ?? []) as any}
      sessions={(sessions ?? []) as any}
    />
  )
}
