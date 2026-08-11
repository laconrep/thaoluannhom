import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { GraduationCap, Users, Presentation, PenLine, ClipboardList } from "lucide-react"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Lớp học thảo luận</p>
              <p className="text-xs text-muted-foreground">Giáo viên THPT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Đăng nhập</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">Đăng ký</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl flex flex-col gap-4">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            Thảo luận - Sửa bài - Chấm điểm
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-balance leading-tight">
            Quản lý lớp học thảo luận và bảng điểm trong một nơi duy nhất
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            Tạo lớp một lần, dùng cho cả năm học. Mỗi buổi thảo luận nhóm hoặc giao việc cá nhân
            đều được lưu lại, chấm điểm tự động cho cả nhóm, xuất bảng điểm cuối kỳ.
          </p>
          <div className="flex gap-3 mt-2">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">Bắt đầu miễn phí</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/login">Tôi đã có tài khoản</Link>
            </Button>
          </div>
        </div>

        <ul className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          <li className="rounded-lg border bg-card p-5 flex flex-col gap-2">
            <Users className="size-5 text-primary" aria-hidden="true" />
            <p className="font-medium">Danh sách lớp và nhóm</p>
            <p className="text-sm text-muted-foreground">
              Tạo lớp, nhập hoặc để học sinh tự ghi tên vào ô của mình. Chia nhóm cố định.
            </p>
          </li>
          <li className="rounded-lg border bg-card p-5 flex flex-col gap-2">
            <Presentation className="size-5 text-primary" aria-hidden="true" />
            <p className="font-medium">Phiên thảo luận nhóm</p>
            <p className="text-sm text-muted-foreground">
              Mỗi nhóm chụp ảnh nộp bài, giáo viên thấy tất cả trên một màn chiếu.
            </p>
          </li>
          <li className="rounded-lg border bg-card p-5 flex flex-col gap-2">
            <PenLine className="size-5 text-primary" aria-hidden="true" />
            <p className="font-medium">Sửa bài trực tiếp</p>
            <p className="text-sm text-muted-foreground">
              Gõ textbox, gạch chân, vẽ bút, chấm điểm. Lưu vĩnh viễn.
            </p>
          </li>
          <li className="rounded-lg border bg-card p-5 flex flex-col gap-2">
            <ClipboardList className="size-5 text-primary" aria-hidden="true" />
            <p className="font-medium">Bảng điểm cả kỳ</p>
            <p className="text-sm text-muted-foreground">
              Mỗi phiên là một cột điểm. Chia sẻ link để học sinh xem (chỉ xem).
            </p>
          </li>
        </ul>
      </section>
    </main>
  )
}
