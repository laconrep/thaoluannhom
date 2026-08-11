import { createClient } from "@/lib/supabase/server"
import { SessionListView } from "../session-list-view"

export default async function IndividualListPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, title, kind, status, duration_seconds, created_at, started_at")
    .eq("class_id", id)
    .eq("kind", "individual")
    .order("created_at", { ascending: false })

  return (
    <SessionListView
      classId={id}
      kind="individual"
      sessions={(sessions ?? []) as any}
    />
  )
}
