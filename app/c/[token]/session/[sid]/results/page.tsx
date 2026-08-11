import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { ClassRow, SessionRow, SessionGroupRow, SubmissionRow, AnnotationRow } from "@/lib/types"
import { ResultsViewer } from "./results-viewer"

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ token: string; sid: string }>
}) {
  const { token, sid } = await params
  const supabase = await createClient()

  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("share_token", token)
    .maybeSingle<ClassRow>()
  if (!cls) notFound()

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sid)
    .eq("class_id", cls.id)
    .maybeSingle<SessionRow>()
  if (!session) notFound()
  if (session.kind !== "group") notFound()
  if (!session.results_shared_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
        <div className="max-w-md text-center space-y-4 p-8 bg-card rounded-xl shadow-sm border">
          <div className="size-16 rounded-full bg-muted mx-auto flex items-center justify-center text-3xl">
            ⏳
          </div>
          <h1 className="text-xl font-semibold">Kết quả chưa được chia sẻ</h1>
          <p className="text-muted-foreground text-sm">
            Giáo viên chưa mở chia sẻ kết quả cho phiên thảo luận này. Em vui lòng quay lại sau.
          </p>
        </div>
      </div>
    )
  }

  const { data: groups } = await supabase
    .from("session_groups")
    .select("*")
    .eq("session_id", sid)
    .order("group_number", { ascending: true })
    .returns<SessionGroupRow[]>()

  const { data: submissions } = await supabase
    .from("submissions")
    .select("*")
    .eq("session_id", sid)
    .returns<SubmissionRow[]>()

  const { data: annotations } = await supabase
    .from("annotations")
    .select("*")
    .eq("session_id", sid)
    .returns<AnnotationRow[]>()

  return (
    <ResultsViewer
      className={cls.name}
      session={session}
      groups={groups ?? []}
      submissions={submissions ?? []}
      annotations={annotations ?? []}
    />
  )
}
