"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { createSessionAction, deleteSessionAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/empty-state"
import { toast } from "sonner"
import {
  Plus,
  Users,
  ClipboardCheck,
  CalendarClock,
  Trash2,
  ArrowRight,
  Timer,
  Sparkles,
  Lock,
  Shuffle,
} from "lucide-react"
import { formatDate } from "@/lib/utils-format"

type Kind = "group" | "individual"
type Session = {
  id: string
  title: string
  kind: Kind
  status: "idle" | "running" | "ended"
  duration_seconds: number
  created_at: string
  started_at: string | null
}

type Preset = { label: string; seconds: number; groups?: number }
const GROUP_PRESETS: Preset[] = [
  { label: "15 phút · 4 nhóm", seconds: 900, groups: 4 },
  { label: "30 phút · 6 nhóm", seconds: 1800, groups: 6 },
  { label: "45 phút · 8 nhóm", seconds: 2700, groups: 8 },
]
const INDIVIDUAL_PRESETS: Preset[] = [
  { label: "10 phút", seconds: 600 },
  { label: "15 phút", seconds: 900 },
  { label: "30 phút", seconds: 1800 },
  { label: "45 phút", seconds: 2700 },
]

export function SessionListView({
  classId,
  kind,
  sessions,
  fixedGroupsCount = 0,
}: {
  classId: string
  kind: Kind
  sessions: Session[]
  fixedGroupsCount?: number
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [duration, setDuration] = useState(900)
  const [numGroups, setNumGroups] = useState(6)
  const [useFixed, setUseFixed] = useState(fixedGroupsCount > 0)
  const [pending, startTransition] = useTransition()

  const isGroup = kind === "group"
  const title1 = isGroup ? "Thảo luận nhóm" : "Giao việc cá nhân"
  const title2 = isGroup
    ? "Các phiên học sinh làm việc theo nhóm, nộp bài báo cáo và được giáo viên chấm điểm."
    : "Mỗi học sinh có một ô riêng để nộp bài và được chấm điểm."

  const Icon = isGroup ? Users : ClipboardCheck
  const presets = isGroup ? GROUP_PRESETS : INDIVIDUAL_PRESETS
  const hasFixed = fixedGroupsCount > 0
  const displayGroups = useFixed && hasFixed ? fixedGroupsCount : numGroups

  function onCreate() {
    const finalTitle = title.trim() || (isGroup ? "Thảo luận mới" : "Giao việc cá nhân")
    startTransition(() => {
      createSessionAction(classId, {
        title: finalTitle,
        kind,
        durationSeconds: duration,
        ...(isGroup
          ? {
              useFixedGroups: hasFixed ? useFixed : false,
              groupCount: useFixed && hasFixed ? fixedGroupsCount : numGroups,
            }
          : {}),
      })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
        <CardHeader className="flex-row items-start justify-between bg-gradient-to-br from-primary/5 to-accent/5">
          <div>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              {title1}
            </CardTitle>
            <CardDescription>{title2}</CardDescription>
          </div>
          {!open && (
            <Button onClick={() => setOpen(true)} className="gap-2 shadow-sm">
              <Plus className="size-4" aria-hidden="true" />
              Tạo phiên mới
            </Button>
          )}
        </CardHeader>
        {open && (
          <CardContent className="border-t bg-muted/20 p-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="s-title">Tên phiên</FieldLabel>
                <Input
                  id="s-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isGroup ? "Ví dụ: Bài 5 - Văn học" : "Ví dụ: Kiểm tra 15'"}
                />
              </Field>

              {isGroup && hasFixed && (
                <Field>
                  <FieldLabel>Cách chia nhóm</FieldLabel>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUseFixed(true)}
                      className={`rounded-lg border p-3 text-left transition ${
                        useFixed
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Lock className="size-4 text-primary" />
                        <span className="font-medium">Dùng nhóm cố định</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Dùng {fixedGroupsCount} nhóm đã phân ở danh sách lớp. HS vào là thấy đúng nhóm của mình.
                        Điểm tự gán cho các thành viên trong nhóm.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseFixed(false)}
                      className={`rounded-lg border p-3 text-left transition ${
                        !useFixed
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Shuffle className="size-4 text-primary" />
                        <span className="font-medium">Chia lại nhóm</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tạo nhóm tạm cho phiên này. HS sẽ tự chọn nhóm và khai tên mình. Điểm vẫn gán theo nhóm đã chọn.
                      </p>
                    </button>
                  </div>
                </Field>
              )}

              <Field>
                <FieldLabel className="flex items-center gap-1">
                  <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                  Chọn nhanh
                </FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant={
                        duration === p.seconds && (!p.groups || numGroups === p.groups)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        setDuration(p.seconds)
                        if (p.groups && !(useFixed && hasFixed)) setNumGroups(p.groups)
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <FieldDescription>Hoặc tùy chỉnh ở dưới</FieldDescription>
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Thời gian (giây)</FieldLabel>
                  <Input
                    type="number"
                    min={30}
                    step={30}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(30, Number(e.target.value) || 30))}
                  />
                  <FieldDescription>{Math.round(duration / 60)} phút</FieldDescription>
                </Field>
                {isGroup && (
                  <Field>
                    <FieldLabel>Số nhóm</FieldLabel>
                    <Input
                      type="number"
                      min={2}
                      max={12}
                      value={displayGroups}
                      disabled={useFixed && hasFixed}
                      onChange={(e) =>
                        setNumGroups(Math.max(2, Math.min(12, Number(e.target.value) || 2)))
                      }
                    />
                    <FieldDescription>
                      {useFixed && hasFixed
                        ? `Đang dùng ${fixedGroupsCount} nhóm cố định của lớp`
                        : "Từ 2 đến 12 nhóm (phiên này)"}
                    </FieldDescription>
                  </Field>
                )}
              </div>

              {isGroup && (
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Xem trước</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: displayGroups }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary"
                      >
                        N{i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={onCreate} disabled={pending} className="shadow-sm">
                  {pending && <Spinner className="mr-2" />}
                  Tạo và vào ngay
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Hủy
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        )}
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <span>{sessions.length} phiên</span>
          {sessions.some((s) => s.status === "running") && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Đang có phiên chạy
            </span>
          )}
        </h3>

        {sessions.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={`Chưa có ${title1.toLowerCase()} nào`}
            description="Bấm 'Tạo phiên mới' ở trên để bắt đầu. Bác có thể dùng preset chọn nhanh."
          />
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border bg-card flex flex-col overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <Link
                  href={
                    isGroup
                      ? `/classes/${classId}/sessions/${s.id}`
                      : `/classes/${classId}/individual/${s.id}`
                  }
                  className="flex-1 p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium leading-snug text-pretty line-clamp-2">{s.title}</h4>
                    {statusBadge(s.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" aria-hidden="true" />
                      {formatDate(s.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3" aria-hidden="true" />
                      {Math.round(s.duration_seconds / 60)} phút
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-2">
                    Mở phiên
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Xóa phiên "${s.title}"? Thao tác này không thể hoàn tác.`)) return
                    startTransition(() => {
                      deleteSessionAction(s.id, classId)
                      toast.success("Đã xóa phiên")
                    })
                  }}
                  className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition flex items-center justify-center gap-1 border-t"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                  Xóa phiên
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function statusBadge(status: string) {
  if (status === "running")
    return (
      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
        Đang chạy
      </span>
    )
  if (status === "ended")
    return (
      <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
        Đã kết thúc
      </span>
    )
  return (
    <span className="rounded-full bg-accent/20 text-accent-foreground px-2 py-0.5 text-xs font-medium">
      Chưa bắt đầu
    </span>
  )
}
