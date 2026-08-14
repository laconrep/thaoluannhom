"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  addClassGroupAction,
  bulkSetNamesAction,
  importStudentsFromListAction,
  moveStudentToGroupAction,
  removeClassGroupAction,
  setCapacityAction,
  updateStudentNameAction,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AvatarInitials } from "@/components/avatar-initials"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus,
  Trash2,
  Users,
  ListPlus,
  Save,
  Minus,
  PresentationIcon,
  ClipboardCheck,
  Table,
  ChevronDown,
  ChevronRight,
  X,
  Info,
  MoveRight,
  GripVertical,
  FileSpreadsheet,
  Upload,
  FileCheck2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { groupCardStyle, groupPillStyle } from "@/lib/group-colors"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"
import { Spinner } from "@/components/ui/spinner"
import { useRef } from "react"

type Student = { id: string; slot_number: number; name: string | null }
type Group = { id: string; group_number: number; label: string; name: string; color: string }

export function RosterView({
  classId,
  capacity,
  students: initialStudents,
  groups: initialGroups,
  memberMap: initialMap,
}: {
  classId: string
  capacity: number
  students: Student[]
  groups: Group[]
  memberMap: Record<string, string[]>
}) {
  const [students, setStudents] = useState<Student[]>(initialStudents)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [memberMap, setMemberMap] = useState<Record<string, string[]>>(initialMap)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<string[] | null>(null)
  const [importFileName, setImportFileName] = useState("")
  const [importBusy, setImportBusy] = useState(false)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [introOpen, setIntroOpen] = useState(false)
  const [dragStudentId, setDragStudentId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  const [moveConfirm, setMoveConfirm] = useState<{
    studentId: string
    fromGroupId: string
    toGroupId: string
  } | null>(null)
  const [, startTransition] = useTransition()
  const fileImportRef = useRef<HTMLInputElement | null>(null)

  // Map ngược: student_id -> group (để tô màu thẻ HS)
  const studentToGroup = useMemo(() => {
    const m = new Map<string, Group>()
    for (const g of groups) {
      for (const sid of memberMap[g.id] ?? []) {
        m.set(sid, g)
      }
    }
    return m
  }, [groups, memberMap])

  const unassignedCount = useMemo(
    () => students.filter((s) => s.name?.trim() && !studentToGroup.has(s.id)).length,
    [students, studentToGroup],
  )

  // Modal hướng dẫn: hiện lần đầu khi lớp đã có nhóm + chưa xem cờ
  useEffect(() => {
    if (typeof window === "undefined") return
    const key = `roster_intro_seen_${classId}`
    if (groups.length > 0 && !localStorage.getItem(key)) {
      setIntroOpen((current) => (current ? current : true))
    }
  }, [classId, groups.length])

  function closeIntro() {
    if (typeof window !== "undefined") {
      localStorage.setItem(`roster_intro_seen_${classId}`, "1")
    }
    setIntroOpen(false)
  }

  // Realtime HS + nhóm
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`class-${classId}-roster`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `class_id=eq.${classId}` },
        (payload: any) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setStudents((cur) =>
              cur.map((s) => (s.id === payload.new.id ? { ...s, name: payload.new.name } : s)),
            )
          } else if (payload.eventType === "INSERT" && payload.new) {
            setStudents((cur) =>
              cur.find((s) => s.id === payload.new.id)
                ? cur
                : [...cur, payload.new].sort((a, b) => a.slot_number - b.slot_number),
            )
          } else if (payload.eventType === "DELETE" && payload.old) {
            setStudents((cur) => cur.filter((s) => s.id !== payload.old.id))
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_groups", filter: `class_id=eq.${classId}` },
        () => {
          // Reload nhóm từ server (đơn giản, ít phát sinh)
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
      const { data } = await supabase
        .from("class_groups")
        .select("id, group_number, label, name, color")
        .eq("class_id", classId)
        .order("group_number")
      if (data) setGroups(data as Group[])
    }
    async function refetchMembers() {
      const { data } = await supabase
        .from("class_group_members")
        .select("class_group_id, student_id, class_groups!inner(class_id)")
        .eq("class_groups.class_id", classId)
      const m: Record<string, string[]> = {}
      for (const row of (data as any[]) ?? []) {
        m[row.class_group_id] ??= []
        m[row.class_group_id].push(row.student_id)
      }
      setMemberMap(m)
    }
    return () => {
      supabase.removeChannel(ch)
    }
  }, [classId])

  function onRenameStudent(id: string, name: string) {
    setStudents((cur) => cur.map((s) => (s.id === id ? { ...s, name } : s)))
    startTransition(() => {
      updateStudentNameAction(id, name)
    })
  }

  function onBulkPaste() {
    const names = bulkText.split(/\r?\n/)
    startTransition(() => {
      bulkSetNamesAction(classId, names)
    })
    setBulkOpen(false)
    setBulkText("")
    toast.success("Đã lưu danh sách")
  }

  // Header detection: bỏ dòng đầu nếu giống tiêu đề cột
  function looksLikeHeader(v: unknown): boolean {
    const s = String(v ?? "").trim().toLowerCase()
    if (!s) return false
    return /^(stt|số thứ tự|sốtt|no|num|number|họ tên|họ và tên|hoten|họ|tên|full name|fullname|name|student|student name|học sinh|học sinh\b)/.test(
      s,
    )
  }

  async function handleImportFile(file: File) {
    setImportBusy(true)
    setImportFileName(file.name)
    setImportPreview(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false })
      let names = rows
        .map((r) => String(r?.[0] ?? "").trim())
        .filter((n) => n.length > 0)
      // Nếu dòng đầu trông giống tiêu đề thì bỏ qua
      if (names.length > 0 && looksLikeHeader(names[0])) names = names.slice(1)
      if (names.length === 0) {
        toast.error("Không tìm thấy cột tên nào. Hãy để họ tên ở cột đầu tiên.")
        return
      }
      setImportPreview(names)
      setImportOpen(true)
    } catch {
      toast.error("Không đọc được file. Hãy dùng file .xlsx, .xls hoặc .csv.")
    } finally {
      setImportBusy(false)
    }
  }

  function onImportConfirm() {
    if (!importPreview || importPreview.length === 0) return
    startTransition(() => {
      importStudentsFromListAction(classId, importPreview).then((res) => {
        if (!res.ok) toast.error(res.error ?? "Không nhập được danh sách.")
        else toast.success(`Đã nhập ${res.added} học sinh`)
      })
    })
    setImportOpen(false)
    setImportPreview(null)
    setImportFileName("")
  }

  function onChangeCapacity(delta: number) {
    const next = Math.max(1, Math.min(80, capacity + delta))
    if (next === capacity) return
    startTransition(() => {
      setCapacityAction(classId, next)
    })
  }

  function onAddGroup() {
    startTransition(() => {
      addClassGroupAction(classId)
    })
  }

  function onRemoveGroup(gid: string) {
    if (!confirm("Xóa nhóm này? Học sinh trong nhóm sẽ trở về trạng thái chưa phân nhóm.")) return
    startTransition(() => {
      removeClassGroupAction(gid, classId)
    })
  }

  // Áp dụng di chuyển HS sang nhóm (đã xác nhận)
  function applyMove(studentId: string, toGroupId: string | null) {
    const prev = studentToGroup.get(studentId)
    // Cập nhật optimistic
    setMemberMap((cur) => {
      const next: Record<string, string[]> = {}
      for (const g of groups) {
        const list = (cur[g.id] ?? []).filter((x) => x !== studentId)
        if (toGroupId && g.id === toGroupId) list.push(studentId)
        next[g.id] = list
      }
      return next
    })
    startTransition(() => {
      moveStudentToGroupAction(studentId, toGroupId, classId).then((res) => {
        if (!res.ok) {
          toast.error(res.error ?? "Không di chuyển được")
          // Rollback bằng cách dựa vào realtime
        } else if (toGroupId) {
          const g = groups.find((x) => x.id === toGroupId)
          toast.success(`Đã thêm học sinh vào ${g?.name ?? "nhóm"}`)
        } else if (prev) {
          toast.success("Đã gỡ học sinh khỏi nhóm")
        }
      })
    })
  }

  // Xử lý thả HS vào nhóm
  function handleDrop(toGroupId: string, studentId: string) {
    const current = studentToGroup.get(studentId)
    if (current?.id === toGroupId) return // cùng nhóm, bỏ qua
    if (current) {
      // HS đã ở nhóm khác → yêu cầu xác nhận
      setMoveConfirm({ studentId, fromGroupId: current.id, toGroupId })
    } else {
      applyMove(studentId, toGroupId)
    }
  }

  const namedCount = students.filter((s) => s.name?.trim()).length

  return (
    <div className="flex flex-col gap-5">
      {/* Modal hướng dẫn */}
      <Dialog open={introOpen} onOpenChange={(v) => !v && closeIntro()}>
        <DialogContent
          className="sm:max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Info className="size-5 text-primary" />
              Cách phân học sinh vào nhóm
            </DialogTitle>
            <DialogDescription>Thầy cô đọc qua 4 bước trước khi bắt đầu.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm leading-relaxed">
            <li className="flex gap-3">
              <span className="size-6 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
                1
              </span>
              <span>
                <strong>Kéo thẻ học sinh</strong> ở khung danh sách chính (bên trái) và{" "}
                <strong>thả vào nhóm</strong> tương ứng ở cột nhóm (bên phải).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="size-6 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
                2
              </span>
              <span>
                Thẻ học sinh <strong>đổi màu theo nhóm</strong>. Cả lớp nhìn lướt là biết em nào
                thuộc nhóm nào.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="size-6 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
                3
              </span>
              <span>
                <strong>Mỗi học sinh chỉ thuộc 1 nhóm.</strong> Kéo em sang nhóm khác sẽ có hộp
                thoại hỏi xác nhận chuyển nhóm.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="size-6 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
                4
              </span>
              <span>
                <strong>Bấm vào tên nhóm</strong> ở cột phải để mở ra, xem danh sách học sinh trong
                nhóm đó. Bấm dấu × để gỡ khỏi nhóm.
              </span>
            </li>
          </ol>
          <DialogFooter>
            <Button onClick={closeIntro} className="w-full sm:w-auto">
              Đã hiểu, bắt đầu phân nhóm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận đổi nhóm */}
      <Dialog open={!!moveConfirm} onOpenChange={(v) => !v && setMoveConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <MoveRight className="size-5 text-primary" />
              Xác nhận chuyển nhóm
            </DialogTitle>
            <DialogDescription>
              {moveConfirm &&
                (() => {
                  const stu = students.find((s) => s.id === moveConfirm.studentId)
                  const from = groups.find((g) => g.id === moveConfirm.fromGroupId)
                  const to = groups.find((g) => g.id === moveConfirm.toGroupId)
                  return (
                    <span>
                      <strong>{stu?.name?.trim() || `Ô ${stu?.slot_number}`}</strong> đang thuộc{" "}
                      <strong>{from?.name}</strong>. Chuyển em sang <strong>{to?.name}</strong>?
                    </span>
                  )
                })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setMoveConfirm(null)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (!moveConfirm) return
                applyMove(moveConfirm.studentId, moveConfirm.toGroupId)
                setMoveConfirm(null)
              }}
            >
              Chuyển nhóm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick actions — 4 nút nổi bật */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <QuickAction
          href={`/classes/${classId}/sessions`}
          icon={<PresentationIcon className="size-5" />}
          label="Thảo luận nhóm"
          accent="primary"
        />
        <QuickAction
          href={`/classes/${classId}/individual`}
          icon={<ClipboardCheck className="size-5" />}
          label="Giao việc cá nhân"
          accent="accent"
        />
        <QuickAction
          href={`/classes/${classId}/gradebook`}
          icon={<Table className="size-5" />}
          label="Bảng điểm"
          accent="primary"
        />
        <QuickAction
          href={`/classes/${classId}/share`}
          icon={<Users className="size-5" />}
          label="Link cho HS"
          accent="accent"
        />
      </div>

      <div className="grid lg:grid-cols-[3fr_2fr] gap-5">
        {/* KHUNG CHÍNH: danh sách HS */}
        <Card className="float-card">
          <CardHeader className="flex flex-row items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 font-heading">
                <Users className="size-4" aria-hidden="true" />
                Danh sách học sinh
              </CardTitle>
              <CardDescription>
                {namedCount}/{capacity} HS đã có tên
                {unassignedCount > 0 && (
                  <>
                    {" · "}
                    <span className="text-primary font-medium">{unassignedCount} chưa phân nhóm</span>
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangeCapacity(-1)}
                aria-label="Giảm sĩ số"
              >
                <Minus className="size-4" aria-hidden="true" />
              </Button>
              <span className="text-sm tabular-nums w-9 text-center font-semibold">{capacity}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangeCapacity(1)}
                aria-label="Tăng sĩ số"
              >
                <Plus className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulkOpen((v) => !v)}>
                <ListPlus className="size-4 mr-1" aria-hidden="true" />
                Dán danh sách
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileImportRef.current?.click()} disabled={importBusy}>
                {importBusy ? (
                  <Spinner className="size-4 mr-1" />
                ) : (
                  <FileSpreadsheet className="size-4 mr-1" aria-hidden="true" />
                )}
                Import Excel
              </Button>
              <input
                ref={fileImportRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImportFile(f)
                  e.target.value = ""
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {importOpen && importPreview && (
              <div className="rounded-lg border bg-muted/40 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
                  Nhập từ {importFileName || "file"}
                  <span className="text-xs text-muted-foreground font-normal">
                    — {importPreview.length} học sinh
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dự kiến ghi tên theo thứ tự ô 1, 2, 3...{importPreview.length > capacity ? ` Sĩ số sẽ tăng lên ${importPreview.length}.` : ""}
                </p>
                <ul className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {importPreview.map((n, i) => (
                    <li
                      key={i}
                      className="rounded bg-background border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      <span className="text-primary tabular-nums font-semibold mr-1">{i + 1}</span>
                      {n}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button size="sm" onClick={onImportConfirm}>
                    <Save className="size-4 mr-1" aria-hidden="true" />
                    Lưu danh sách
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setImportOpen(false)
                      setImportPreview(null)
                      setImportFileName("")
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}
            {bulkOpen && (
              <div className="rounded-lg border bg-muted/40 p-3 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  Dán danh sách (mỗi dòng một tên, theo thứ tự ô 1, 2, 3...). Ô trống sẽ để tên rỗng.
                </p>
                <textarea
                  className="min-h-[180px] w-full rounded-md border bg-background p-2 text-sm font-mono"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Nguyễn Văn An\nTrần Thị Bình\n..."}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={onBulkPaste}>
                    <Save className="size-4 mr-1" aria-hidden="true" />
                    Lưu danh sách
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setBulkOpen(false)}>
                    Hủy
                  </Button>
                </div>
              </div>
            )}

            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {students.map((s) => {
                const g = studentToGroup.get(s.id)
                const hasName = !!s.name?.trim()
                return (
                  <li
                    key={s.id}
                    draggable={hasName}
                    onDragStart={(e) => {
                      if (!hasName) {
                        e.preventDefault()
                        return
                      }
                      setDragStudentId(s.id)
                      e.dataTransfer.effectAllowed = "move"
                      e.dataTransfer.setData("text/plain", s.id)
                    }}
                    onDragEnd={() => {
                      setDragStudentId(null)
                      setDragOverGroupId(null)
                    }}
                    className={cn(
                      "group rounded-lg border bg-card transition px-2.5 py-2 flex items-center gap-2.5",
                      hasName ? "cursor-grab active:cursor-grabbing" : "opacity-70",
                      dragStudentId === s.id && "opacity-40",
                      !g && "hover:bg-muted/30",
                    )}
                    style={g ? groupCardStyle(g.color) : undefined}
                    title={
                      hasName
                        ? g
                          ? `${s.name} — ${g.name}. Kéo sang nhóm khác để đổi.`
                          : `Kéo ${s.name} vào một nhóm bên phải.`
                        : "Nhập tên trước khi phân nhóm."
                    }
                  >
                    {hasName && (
                      <GripVertical
                        className="size-3.5 text-muted-foreground/50 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <AvatarInitials name={s.name} seed={`${classId}-${s.slot_number}`} size="md" />
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="size-5 rounded bg-muted text-muted-foreground grid place-items-center text-[10px] font-semibold tabular-nums shrink-0">
                          {s.slot_number}
                        </span>
                        <Input
                          className="h-7 border-0 shadow-none focus-visible:ring-1 focus-visible:bg-background px-1.5 text-sm font-medium flex-1"
                          defaultValue={s.name ?? ""}
                          placeholder="Chưa có tên"
                          onBlur={(e) => onRenameStudent(s.id, e.target.value)}
                        />
                      </div>
                      {g && (
                        <span
                          className="mt-0.5 inline-flex items-center gap-1 rounded-full text-[10px] font-medium border px-1.5 py-0 w-fit"
                          style={groupPillStyle(g.color)}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: g.color }}
                          />
                          {g.name}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        {/* CỘT PHẢI: danh sách nhóm */}
        <Card className="float-card">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-heading">Nhóm cố định</CardTitle>
              <CardDescription>
                Kéo HS từ bên trái thả vào một nhóm. Dùng chung cho mọi phiên thảo luận.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onAddGroup}>
              <Plus className="size-4 mr-1" aria-hidden="true" />
              Thêm nhóm
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {groups.map((g) => {
              const members = students.filter((s) => (memberMap[g.id] ?? []).includes(s.id))
              const expanded = expandedGroupId === g.id
              const isDragOver = dragOverGroupId === g.id
              return (
                <div
                  key={g.id}
                  onDragOver={(e) => {
                    if (!dragStudentId) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setDragOverGroupId(g.id)
                  }}
                  onDragLeave={(e) => {
                    // chỉ clear khi rời hẳn container
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return
                    setDragOverGroupId((cur) => (cur === g.id ? null : cur))
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const sid = e.dataTransfer.getData("text/plain") || dragStudentId
                    setDragOverGroupId(null)
                    setDragStudentId(null)
                    if (sid) handleDrop(g.id, sid)
                  }}
                  className={cn(
                    "rounded-lg border bg-card transition",
                    isDragOver && "ring-2 ring-offset-1 scale-[1.01]",
                  )}
                  style={{
                    borderColor: g.color,
                    // @ts-ignore ring color
                    "--tw-ring-color": g.color,
                  } as any}
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedGroupId(expanded ? null : g.id)}
                      className="text-left flex-1 min-w-0 flex items-center gap-2"
                      aria-expanded={expanded}
                    >
                      {expanded ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: g.color }}
                        aria-hidden="true"
                      />
                      <p className="font-medium text-sm truncate">{g.name}</p>
                      <span
                        className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border shrink-0"
                        style={groupPillStyle(g.color)}
                      >
                        {members.length} HS
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveGroup(g.id)}
                      aria-label="Xóa nhóm"
                    >
                      <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                  {/* Preview avatars khi thu gọn */}
                  {!expanded && members.length > 0 && (
                    <div className="px-3 pb-2 flex items-center -space-x-1.5">
                      {members.slice(0, 8).map((m) => (
                        <AvatarInitials
                          key={m.id}
                          name={m.name}
                          seed={`${classId}-${m.slot_number}`}
                          size="xs"
                          className="ring-2 ring-card"
                        />
                      ))}
                      {members.length > 8 && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          +{members.length - 8}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Khung thả trong trạng thái kéo */}
                  {dragStudentId && !expanded && members.length === 0 && (
                    <div
                      className="mx-3 mb-2 rounded-md border-2 border-dashed py-3 text-center text-xs text-muted-foreground"
                      style={{ borderColor: g.color }}
                    >
                      Thả học sinh vào đây
                    </div>
                  )}
                  {expanded && (
                    <div
                      className="border-t px-3 py-2.5 flex flex-col gap-2"
                      style={{ borderColor: `${g.color}33` }}
                    >
                      {members.length === 0 ? (
                        <div
                          className="rounded-md border-2 border-dashed py-4 text-center text-xs text-muted-foreground"
                          style={{ borderColor: g.color }}
                        >
                          Chưa có học sinh nào. Kéo từ danh sách bên trái thả vào đây.
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {members
                            .sort((a, b) => a.slot_number - b.slot_number)
                            .map((m) => (
                              <li
                                key={m.id}
                                className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                                style={{ borderColor: `${g.color}44` }}
                              >
                                <AvatarInitials
                                  name={m.name}
                                  seed={`${classId}-${m.slot_number}`}
                                  size="xs"
                                />
                                <span className="text-[10px] tabular-nums font-semibold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {m.slot_number}
                                </span>
                                <span className="flex-1 text-sm font-medium truncate">
                                  {m.name?.trim() || "—"}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  aria-label={`Gỡ ${m.name} khỏi ${g.name}`}
                                  onClick={() => applyMove(m.id, null)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Chưa có nhóm nào. Bấm <strong>Thêm nhóm</strong> để bắt đầu.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickAction({
  href,
  icon,
  label,
  accent,
}: {
  href: string
  icon: React.ReactNode
  label: string
  accent: "primary" | "accent"
}) {
  const color =
    accent === "primary"
      ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
      : "bg-accent/20 text-accent-foreground group-hover:bg-accent group-hover:text-accent-foreground"
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card float-card hover:border-primary/40 transition px-4 py-3 flex items-center gap-3"
    >
      <div className={`size-10 rounded-lg grid place-items-center transition ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  )
}
