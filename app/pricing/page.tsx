import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { upgradeToPlanAction } from "@/app/actions"
import { PLANS, PLAN_DEFAULT, type Plan } from "@/lib/plans"
import { Button } from "@/components/ui/button"
import { GraduationCap, Check, ArrowLeft } from "lucide-react"

export default async function PricingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()
  const currentPlan = (profile?.plan as Plan | undefined) ?? PLAN_DEFAULT

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Lớp học thảo luận</p>
              <p className="text-xs text-muted-foreground">Chọn gói phù hợp</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard" className="gap-1">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Về lớp của tôi
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold font-heading text-balance">
            Gói sử dụng
          </h1>
          <p className="text-muted-foreground mt-3 text-pretty">
            Bắt đầu miễn phí, nâng cấp khi cần thêm lớp. Hiện tại việc chọn gói được kích hoạt ngay
            để trải nghiệm; hệ thống thanh toán sẽ được bật chính thức sau.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-10 max-w-5xl mx-auto">
          {PLANS.map((p) => {
            const isCurrent = currentPlan === p.id
            return (
              <div
                key={p.id}
                className={`rounded-2xl border bg-card p-6 flex flex-col gap-4 ${
                  p.highlight ? "border-primary ring-2 ring-primary/30 shadow-lg" : ""
                }`}
              >
                <div>
                  <p className="font-heading font-semibold text-lg">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.tagline}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold font-heading">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <Button disabled className="w-full">
                      Gói hiện tại
                    </Button>
                  ) : p.id === "school" ? (
                    <Button asChild variant="outline" className="w-full">
                      <a href="mailto:support@example.com?subject=Đăng ký gói Trường học">
                        Liên hệ
                      </a>
                    </Button>
                  ) : (
                    <form
                      action={async () => {
                        "use server"
                        await upgradeToPlanAction(p.id)
                      }}
                    >
                      <Button className="w-full">Chọn gói {p.name}</Button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
