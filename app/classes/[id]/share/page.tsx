import { createClient } from "@/lib/supabase/server"
import { ShareView } from "./share-view"

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: cls } = await supabase
    .from("classes")
    .select("share_token, name")
    .eq("id", id)
    .single()

  return <ShareView classId={id} shareToken={cls?.share_token ?? ""} className={cls?.name ?? ""} />
}
