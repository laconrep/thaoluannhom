import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TeacherShell } from "@/components/teacher-shell"
import { ClassTabs } from "./class-tabs"
import { ChevronRight, Users } from "lucide-react"

export default async function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, capacity, teacher_id, share_token")
    .eq("id", id)
    .single()

  if (!cls || cls.teacher_id !== user.id) notFound()

  return (
    <TeacherShell email={user.email}>
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 pt-3 pb-0">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
            <Link href="/dashboard" className="hover:text-foreground hover:underline">
              Lớp của tôi
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="text-foreground font-medium truncate">{cls.name}</span>
          </nav>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-xl md:text-2xl font-bold leading-tight">
                {cls.name}
              </h1>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5">
                <Users className="size-3" aria-hidden="true" />
                Sĩ số {cls.capacity}
              </span>
            </div>
          </div>
          <ClassTabs classId={cls.id} />
        </div>
      </div>
      <section className="mx-auto max-w-7xl px-4 py-5">{children}</section>
    </TeacherShell>
  )
}
