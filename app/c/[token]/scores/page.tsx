import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function StudentScoresPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const { data: cls } = await supabase.from("classes").select("*").eq("share_token", token).single()
  if (!cls) notFound()

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("class_id", cls.id)
    .eq("scores_shared", true)
    .order("created_at", { ascending: false })

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", cls.id)
    .order("slot_number")

  const sessIds = (sessions ?? []).map((s) => s.id)
  const { data: scores } = sessIds.length
    ? await supabase.from("student_scores").select("*").in("session_id", sessIds)
    : { data: [] }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link href={`/c/${token}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">{cls.name}</p>
            <h1 className="font-semibold">Bảng điểm lớp</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {(sessions ?? []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Giáo viên chưa công khai bảng điểm nào.
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="text-left p-3 font-semibold">STT</th>
                  <th className="text-left p-3 font-semibold min-w-[160px]">Họ và tên</th>
                  {(sessions ?? []).map((s) => (
                    <th key={s.id} className="text-center p-3 font-medium text-xs min-w-[80px]">
                      {s.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(students ?? []).map((st) => (
                  <tr key={st.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 text-muted-foreground">{st.slot_number}</td>
                    <td className="p-3 font-medium">{st.name || "—"}</td>
                    {(sessions ?? []).map((s) => {
                      const row = (scores ?? []).find(
                        (sc) => sc.session_id === s.id && sc.student_id === st.id,
                      )
                      return (
                        <td key={s.id} className="p-3 text-center font-mono tabular-nums">
                          {row?.score ?? "—"}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  )
}
