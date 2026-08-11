import { createClient } from "@/lib/supabase/server"
import { SessionListView } from "../session-list-view"

export default async function SessionsListPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: sessions }, { count: groupCount }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, title, kind, status, duration_seconds, created_at, started_at")
      .eq("class_id", id)
      .eq("kind", "group")
      .order("created_at", { ascending: false }),
    supabase
      .from("class_groups")
      .select("*", { count: "exact", head: true })
      .eq("class_id", id),
  ])

  return (
    <SessionListView
      classId={id}
      kind="group"
      sessions={(sessions ?? []) as any}
      fixedGroupsCount={groupCount ?? 0}
    />
  )
}
