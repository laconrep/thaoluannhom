import Link from "next/link"
import { GraduationCap, LayoutDashboard } from "lucide-react"
import { signOutAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AvatarInitials } from "@/components/avatar-initials"

export function TeacherShell({
  children,
  email,
}: {
  children: React.ReactNode
  email?: string | null
}) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="border-b bg-card/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-sm">
              <GraduationCap className="size-4" aria-hidden="true" />
            </div>
            <span className="font-heading text-sm md:text-base">Lớp học thảo luận</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="ml-1 hidden sm:inline-flex">
            <Link href="/dashboard" className="gap-2">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Lớp của tôi
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle compact />
            {email && (
              <div className="flex items-center gap-2 pl-1.5 border-l ml-1">
                <AvatarInitials name={email.split("@")[0]} size="sm" />
                <span className="text-xs text-muted-foreground hidden md:inline max-w-[160px] truncate">
                  {email}
                </span>
              </div>
            )}
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Đăng xuất
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
