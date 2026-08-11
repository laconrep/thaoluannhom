import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TeacherShell } from "@/components/teacher-shell"
import { CreateClassCard } from "./create-class-card"
import { Users, ArrowRight, CalendarRange, Trash2, School } from "lucide-react"
import { deleteClassAction } from "@/app/actions"
import { formatDateShort } from "@/lib/utils-format"
import { EmptyState } from "@/components/empty-state"

type ClassWithCounts = {
  id: string
  name: string
  capacity: number
  created_at: string
  students: { count: number }[]
  sessions: { count: number }[]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, capacity, created_at, students(count), sessions(count)")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  const list = (classes as ClassWithCounts[] | null) ?? []

  return (
    <TeacherShell email={user.email}>
      <section className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl md:text-3xl font-bold">Lớp của tôi</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Mỗi lớp có danh sách học sinh, nhóm cố định và nhiều phiên thảo luận.
          </p>
        </header>

        <CreateClassCard />

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Tổng cộng {list.length} lớp
            </h2>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={School}
              title="Chưa có lớp nào"
              description="Hãy tạo lớp đầu tiên của bạn ở trên. Mỗi lớp có danh sách HS, nhóm cố định và không giới hạn phiên thảo luận."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((c) => {
                const filled = c.students?.[0]?.count ?? 0
                const sessions = c.sessions?.[0]?.count ?? 0
                return (
                  <li
                    key={c.id}
                    className="group rounded-xl border bg-card float-card flex items-stretch overflow-hidden hover:border-primary/40 transition"
                  >
                    <Link
                      href={`/classes/${c.id}/roster`}
                      className="flex-1 px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition"
                    >
                      <div className="size-11 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                        <School className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-semibold text-base leading-snug truncate">
                          {c.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3" aria-hidden="true" />
                            {filled}/{c.capacity} chỗ
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange className="size-3" aria-hidden="true" />
                            {sessions} phiên
                          </span>
                          <span className="text-[11px]">Tạo {formatDateShort(c.created_at)}</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                        Vào lớp
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </Link>
                    <form
                      action={async () => {
                        "use server"
                        await deleteClassAction(c.id)
                      }}
                      className="border-l"
                    >
                      <button
                        type="submit"
                        className="h-full px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition grid place-items-center"
                        aria-label={`Xóa ${c.name}`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </form>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </TeacherShell>
  )
}
