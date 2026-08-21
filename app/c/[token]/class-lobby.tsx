"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { fetchClassGroups } from "@/lib/class-groups"
import { leaderUpdateGroupMembersAction, studentSetNameAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AvatarInitials } from "@/components/avatar-initials"
import { useCountdown, formatClock } from "@/lib/use-countdown"
import {
  ArrowRight,
  Crown,
  GraduationCap,
  ClipboardList,
  Lock,
  Users,
  Minus,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
type Group = { id: string; name: string; color: string; leader_student_id: string | null }
type GroupMember = { class_group_id: string; student_id: string }

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
  groups: initialGroups,
  members: initialMembers,
}: {
  classId: string
  className: string
  token: string
  students: Student[]
  sessions: Session[]
  groups: Group[]
  members: GroupMember[]
}) {
  const [students, setStudents] = useState(initialStudents)
  const [sessions, setSessions] = useState(initialSessions)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [members, setMembers] = useState<GroupMember[]>(initialMembers)
  const [myStudentId, setMyStudentId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [leaderOpen, setLeaderOpen] = useState(false)
  const [saving, startTransition] = useTransition()

  // Load identity from localStorage
  useEffect(() => {
    const dt = getDeviceToken()
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_groups", filter: `class_id=eq.${classId}` },
        () => {
          refetchGroups()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_group_members" },
        () => {
          refetchMembers()
        },
      )
      .subscribe()

    async function refetchGroups() {
      const data = await fetchClassGroups(supabase, classId)
      setGroups(data)
    }
    async function refetchMembers() {
      const { data } = await supabase
        .from("class_group_members")
        .select("class_group_id, student_id, class_groups!inner(class_id)")
        .eq("class_groups.class_id", classId)
      if (data) setMembers(data as GroupMember[])
    }
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
      studentSetNameAction(studentId, name.trim(), getDeviceToken())
    })
  }

  function changeSlot() {
    localStorage.removeItem(`class_${classId}_student`)
    setMyStudentId(null)
    setSelectedSlot(null)
  }

  // Nhóm chứa mình (qua members)
  const myGroup = useMemo(() => {
    if (!myStudentId) return null
    const m = members.find((x) => x.student_id === myStudentId)
    return m ? groups.find((g) => g.id === m.class_group_id) ?? null : null
  }, [myStudentId, members, groups])

  // Nhóm mà mình làm nhóm trưởng
  const myLeaderGroup = useMemo(
    () => (myStudentId ? groups.find((g) => g.leader_student_id === myStudentId) ?? null : null),
    [myStudentId, groups],
  )

  // Map student_id -> group (để xác định trạng thái từng thẻ HS)
  const studentToGroup = useMemo(() => {
    const m = new Map<string, Group>()
    for (const g of groups) {
      for (const mem of members) {
        if (mem.class_group_id === g.id) m.set(mem.student_id, g)
      }
    }
    return m
  }, [groups, members])

  async function leaderAdd(targetStudentId: string) {
    const res = await leaderUpdateGroupMembersAction({
      classId,
      leaderStudentId: myStudentId!,
      deviceToken: getDeviceToken(),
      targetStudentId,
      action: "add",
    })
    if (!res.ok) toast.error(res.error ?? "Không thêm được")
  }

  async function leaderRemove(targetStudentId: string) {
    const res = await leaderUpdateGroupMembersAction({
      classId,
      leaderStudentId: myStudentId!,
      deviceToken: getDeviceToken(),
      targetStudentId,
      action: "remove",
    })
    if (!res.ok) toast.error(res.error ?? "Không gỡ được")
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

        {myLeaderGroup && (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-heading">
                  <Crown className="size-5 text-amber-500" aria-hidden="true" />
                  Nhóm trưởng {myLeaderGroup.name}
                </CardTitle>
                <CardDescription>
                  {myGroup?.id === myLeaderGroup.id
                    ? "Em đang ở nhóm của mình. Bấm để chọn thêm thành viên cho cả lớp."
                    : "Em chưa nằm trong nhóm của mình. Bấm để chọn thành viên."}
                </CardDescription>
              </div>
              <Button onClick={() => setLeaderOpen(true)}>
                <Users className="size-4 mr-1" aria-hidden="true" />
                Chọn thành viên
              </Button>
            </CardHeader>
          </Card>
        )}

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

      {/* Dialog chọn thành viên cho nhóm trưởng */}
      <Dialog open={leaderOpen} onOpenChange={setLeaderOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Crown className="size-5 text-amber-500" aria-hidden="true" />
              Chọn thành viên cho {myLeaderGroup?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              Bấm vào học sinh chưa có nhóm để thêm vào nhóm của em. Học sinh ở nhóm khác cần giáo
              viên thay đổi.
            </p>
            {students.map((s) => {
              const stuGroup = studentToGroup.get(s.id)
              const inMine = stuGroup?.id === myLeaderGroup?.id
              const isMe = s.id === myStudentId
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
                    inMine ? "border-amber-300 bg-amber-50/50" : "border-border bg-card",
                  )}
                >
                  <AvatarInitials name={s.name} seed={`${classId}-${s.slot_number}`} size="xs" />
                  <span className="text-[10px] tabular-nums font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {s.slot_number}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {s.name?.trim() || "—"}
                  </span>
                  {stuGroup ? (
                    inMine ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-amber-700">Nhóm em</span>
                        {!isMe && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            aria-label={`Gỡ ${s.name} khỏi nhóm`}
                            onClick={() => leaderRemove(s.id)}
                          >
                            <Minus className="size-3.5 text-destructive" aria-hidden="true" />
                          </Button>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3.5" aria-hidden="true" />
                        {stuGroup.name}
                      </span>
                    )
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5"
                      disabled={!s.name?.trim()}
                      onClick={() => leaderAdd(s.id)}
                    >
                      Thêm vào nhóm
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
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
