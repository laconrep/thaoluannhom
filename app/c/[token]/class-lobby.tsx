"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { studentSetNameAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useCountdown, formatClock } from "@/lib/use-countdown"
import { ArrowRight, GraduationCap, ClipboardList, Users } from "lucide-react"

type Student = {
  id: string
  slot_number: number
  name: string | null
  device_token: string | null
}
type Session = {
  id: string
  title: string
  kind: "group" | "individual"
  status: string
  started_at: string | null
  ends_at: string | null
  duration_seconds: number
}

function getDeviceToken() {
  if (typeof window === "undefined") return ""
  let t = localStorage.getItem("device_token")
  if (!t) {
    t = crypto.randomUUID()
    localStorage.setItem("device_token", t)
  }
  return t
}

export function ClassLobby({
  classId,
  className,
  token,
  students: initialStudents,
  sessions: initialSessions,
}: {
  classId: string
  className: string
  token: string
  students: Student[]
  sessions: Session[]
}) {
  const [students, setStudents] = useState(initialStudents)
  const [sessions, setSessions] = useState(initialSessions)
  const [myStudentId, setMyStudentId] = useState<string | null>(null)
  const [deviceToken, setDeviceToken] = useState<string>("")
  const [name, setName] = useState("")
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [saving, startTransition] = useTransition()

  // Load identity from localStorage
  useEffect(() => {
    const dt = getDeviceToken()
    setDeviceToken(dt)
    const saved = localStorage.getItem(`class_${classId}_student`)
    if (saved) {
      const st = students.find((s) => s.id === saved)
      if (st) setMyStudentId(saved)
    } else {
      // cũng thử tìm qua device_token
      const match = students.find((s) => s.device_token === dt)
      if (match) {
        setMyStudentId(match.id)
        localStorage.setItem(`class_${classId}_student`, match.id)
      }
    }
  }, [classId, students])

  // Realtime: sessions appearing/disappearing + students name updates
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`lobby-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `class_id=eq.${classId}` },
        (p: any) => {
          if (p.eventType === "UPDATE" && p.new) {
            setStudents((cur) =>
              cur.map((s) => (s.id === p.new.id ? (p.new as Student) : s)),
            )
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `class_id=eq.${classId}` },
        (p: any) => {
          if (p.eventType === "INSERT" && p.new) {
            setSessions((cur) => [p.new as Session, ...cur])
          } else if (p.eventType === "UPDATE" && p.new) {
            setSessions((cur) => {
              const exists = cur.find((x) => x.id === p.new.id)
              if (p.new.status === "ended") {
                return cur.filter((x) => x.id !== p.new.id)
              }
              if (exists) {
                return cur.map((x) => (x.id === p.new.id ? (p.new as Session) : x))
              }
              return [p.new as Session, ...cur]
            })
          } else if (p.eventType === "DELETE" && p.old) {
            setSessions((cur) => cur.filter((x) => x.id !== p.old.id))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [classId])

  function claimSlot(studentId: string) {
    if (!name.trim()) {
      alert("Vui lòng nhập tên trước.")
      return
    }
    setMyStudentId(studentId)
    localStorage.setItem(`class_${classId}_student`, studentId)
    startTransition(() => {
      studentSetNameAction(studentId, name.trim(), deviceToken)
    })
  }

  function changeSlot() {
    localStorage.removeItem(`class_${classId}_student`)
    setMyStudentId(null)
    setSelectedSlot(null)
  }

  if (!myStudentId) {
    return (
      <main className="min-h-svh bg-muted/40 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <GraduationCap className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>{className}</CardTitle>
                <CardDescription>Chọn ô của em trong lớp</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Tên của em</FieldLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                />
              </Field>
            </FieldGroup>
            <p className="text-sm text-muted-foreground">
              Bấm vào ô có số của em (giáo viên đã xếp số theo lớp).
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[50vh] overflow-auto p-1">
              {students.map((s) => {
                const taken = !!s.name?.trim()
                const selected = selectedSlot === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSlot(s.id)}
                    className={
                      "aspect-square rounded-md border p-1 text-xs flex flex-col items-center justify-center gap-1 transition " +
                      (selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : taken
                          ? "bg-muted border-muted hover:bg-muted/70"
                          : "bg-card hover:bg-muted/40")
                    }
                  >
                    <span className="font-mono tabular-nums opacity-80">{s.slot_number}</span>
                    <span className="text-[10px] line-clamp-2 text-center">
                      {s.name?.trim() || <span className="opacity-60">Trống</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            {selectedSlot && (
              <Button
                onClick={() => claimSlot(selectedSlot)}
                disabled={!name.trim() || saving}
                size="lg"
              >
                Tôi là ô số{" "}
                {students.find((s) => s.id === selectedSlot)?.slot_number}
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    )
  }

  const me = students.find((s) => s.id === myStudentId)

  return (
    <main className="min-h-svh bg-muted/40 p-4">
      <div className="mx-auto max-w-3xl flex flex-col gap-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{className}</CardTitle>
              <CardDescription>
                Ô số {me?.slot_number} — {me?.name}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={changeSlot}>
              Đổi ô
            </Button>
          </CardHeader>
        </Card>

        <h2 className="text-sm font-semibold text-muted-foreground">Các phiên đang mở</h2>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Hiện chưa có phiên nào mở. Chờ giáo viên bắt đầu.
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} token={token} />
            ))}
          </ul>
        )}

        <div className="text-center mt-6">
          <Button asChild variant="outline" size="sm">
            <Link href={`/c/${token}/scores`} className="gap-2">
              <ClipboardList className="size-4" aria-hidden="true" />
              Xem bảng điểm
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

function SessionRow({ session, token }: { session: Session; token: string }) {
  const left = useCountdown(session.ends_at, session.status)
  return (
    <li>
      <Link
        href={`/c/${token}/session/${session.id}`}
        className="block rounded-lg border bg-card p-4 hover:bg-muted/30 transition"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold text-pretty">{session.title}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
              {session.kind === "group" ? (
                <>
                  <Users className="size-3" aria-hidden="true" /> Thảo luận nhóm
                </>
              ) : (
                <>
                  <ClipboardList className="size-3" aria-hidden="true" /> Làm bài cá nhân
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            {session.status === "running" ? (
              <span className="text-lg font-mono tabular-nums text-primary">
                {formatClock(left)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Chưa bắt đầu</span>
            )}
            <ArrowRight className="size-4 inline-block ml-2" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </li>
  )
}
