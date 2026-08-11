"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Send,
  Users,
  User,
  X,
  Upload,
  ImageIcon,
  File as FileIcon,
  Presentation,
  Ban,
  Sparkles,
  Share2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useCountdown } from "@/lib/use-countdown"
import { formatDuration } from "@/lib/utils-format"
import { fireConfetti } from "@/lib/confetti"
import {
  studentClaimGroupAction,
  submitGroupReportAction,
  studentClaimSlotAction,
  submitIndividualReportAction,
} from "@/app/actions"
import type {
  SessionRow,
  SessionGroupRow,
  SessionSlotRow,
  StudentRow,
  SubmissionFile,
  SubmissionFileKind,
} from "@/lib/types"

type Props = {
  kind: "group" | "individual"
  classId: string
  className: string
  session: SessionRow
  groups: SessionGroupRow[]
  slots: SessionSlotRow[]
  students: StudentRow[]
  shareToken: string
}

function deviceId() {
  if (typeof window === "undefined") return ""
  const key = "tln_device_id"
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function detectKind(mime: string, name: string): SubmissionFileKind {
  const n = name.toLowerCase()
  if (mime.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(n)) return "image"
  if (mime === "application/pdf" || n.endsWith(".pdf")) return "pdf"
  if (n.endsWith(".pptx") || mime.includes("presentation")) return "pptx"
  if (n.endsWith(".docx") || mime.includes("wordprocessingml")) return "docx"
  return "other"
}

function iconFor(kind: SubmissionFileKind) {
  switch (kind) {
    case "image":
      return <ImageIcon className="w-4 h-4" aria-hidden="true" />
    case "pdf":
      return <FileIcon className="w-4 h-4" aria-hidden="true" />
    case "pptx":
      return <Presentation className="w-4 h-4" aria-hidden="true" />
    case "docx":
      return <FileText className="w-4 h-4" aria-hidden="true" />
    default:
      return <FileIcon className="w-4 h-4" aria-hidden="true" />
  }
}

const ACCEPT =
  "image/*,.pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"

type StagedFile = {
  id: string
  file: File
  kind: SubmissionFileKind
  previewUrl: string | null
}

export function StudentSubmit({
  kind,
  classId: _classId,
  className,
  session: initialSession,
  groups: g0,
  slots: s0,
  students,
  shareToken,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState(initialSession)
  const [groups, setGroups] = useState(g0)
  const [slots, setSlots] = useState(s0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selfStudentId, setSelfStudentId] = useState<string | null>(null)
  const [identityLoaded, setIdentityLoaded] = useState(false)
  const autoSubmitted = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const remaining = useCountdown(session.ends_at ?? null, session.status)
  const ended = session.status === "ended" || (session.ends_at != null && remaining <= 0)
  const running = session.status === "running" && !ended
  const allowPaste = session.allow_paste
  const resultsShared = !!session.results_shared_at && kind === "group"

  // Với phiên group "chia lại nhóm" (không dùng nhóm cố định), HS phải khai tên mình
  // để hệ thống biết ai thuộc nhóm nào, phục vụ tự động gán điểm sau khi GV chấm.
  const needsSelfIdentify =
    kind === "group" && !session.use_fixed_groups && students.length > 0 && !selfStudentId

  // Load tên đã chọn từ localStorage
  useEffect(() => {
    if (kind !== "group" || session.use_fixed_groups) return
    if (typeof window === "undefined") return
    const key = `tln_self_${session.id}`
    const saved = localStorage.getItem(key)
    if (saved && students.some((s) => s.id === saved)) {
      setSelfStudentId(saved)
    }
    setIdentityLoaded(true)
  }, [kind, session.id, session.use_fixed_groups, students])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`stu_${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (p: any) => {
          if (p.new) setSession(p.new)
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_groups", filter: `session_id=eq.${session.id}` },
        (p: any) => {
          if (p.new) setGroups((prev) => prev.map((x) => (x.id === p.new.id ? p.new : x)))
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_slots", filter: `session_id=eq.${session.id}` },
        (p: any) => {
          if (p.new) setSlots((prev) => prev.map((x) => (x.id === p.new.id ? p.new : x)))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session.id, supabase])

  useEffect(() => {
    if (kind !== "group" || !selectedId) return
    const g = groups.find((x) => x.id === selectedId)
    if (g && !g.claimed) {
      setSelectedId(null)
      setSubmitted(false)
      autoSubmitted.current = false
    }
  }, [groups, kind, selectedId])

  async function pickGroup(gid: string) {
    setBusy(true)
    try {
      const res = await studentClaimGroupAction(gid, deviceId(), selfStudentId)
      if (!res.ok) toast.error(res.error ?? "Không thể chọn nhóm.")
      else setSelectedId(gid)
    } finally {
      setBusy(false)
    }
  }

  async function pickSlot(slotId: string, studentId?: string | null) {
    setBusy(true)
    try {
      const res = await studentClaimSlotAction(slotId, deviceId(), studentId ?? null)
      if (!res.ok) toast.error(res.error ?? "Không thể chọn ô.")
      else setSelectedId(slotId)
    } finally {
      setBusy(false)
    }
  }

  function addFiles(files: FileList | File[] | null) {
    if (!files) return
    const arr = Array.from(files).slice(0, 20)
    setStaged((prev) => {
      const next = [...prev]
      for (const f of arr) {
        const k = detectKind(f.type, f.name)
        const previewUrl = k === "image" ? URL.createObjectURL(f) : null
        next.push({
          id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          kind: k,
          previewUrl,
        })
      }
      return next
    })
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const t = prev.find((x) => x.id === id)
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl)
      return prev.filter((x) => x.id !== id)
    })
  }

  useEffect(() => {
    return () => {
      staged.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function uploadAll(): Promise<SubmissionFile[]> {
    if (!staged.length) return []
    const uploaded: SubmissionFile[] = []
    for (const s of staged) {
      const ext = s.file.name.split(".").pop() ?? "bin"
      const path = `${session.id}/${selectedId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("submissions")
        .upload(path, s.file, { upsert: true, contentType: s.file.type || undefined })
      if (upErr) throw new Error(upErr.message)
      const { data } = supabase.storage.from("submissions").getPublicUrl(path)
      uploaded.push({
        url: data.publicUrl,
        name: s.file.name,
        kind: s.kind,
        mime: s.file.type || "application/octet-stream",
        rotation: 0,
      })
    }
    return uploaded
  }

  async function handleSubmit(auto = false) {
    if (!selectedId) return
    setBusy(true)
    try {
      const files = await uploadAll()
      if (kind === "group") {
        await submitGroupReportAction({
          sessionId: session.id,
          sessionGroupId: selectedId,
          textContent: text.trim() || null,
          files,
          isAuto: auto,
        })
      } else {
        await submitIndividualReportAction({
          sessionId: session.id,
          sessionSlotId: selectedId,
          textContent: text.trim() || null,
          files,
          isAuto: auto,
        })
      }
      setSubmitted(true)
      if (!auto) fireConfetti()
    } catch (e: any) {
      toast.error(e?.message ?? "Có lỗi xảy ra.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!identityLoaded || !ended || autoSubmitted.current || submitted || !selectedId) return
    if (!text.trim() && !staged.length) return
    autoSubmitted.current = true
    handleSubmit(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, identityLoaded, selectedId, staged.length, submitted, text])

  if (submitted) {
    const returnHref = typeof window !== "undefined" ? `/c/${window.location.pathname.split("/")[2]}` : "/"
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4 float-card">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h2 className="font-heading text-2xl font-bold">Đã nộp bài!</h2>
          <p className="text-muted-foreground text-pretty">
            {staged.length > 1 ? `${staged.length} tệp` : "Bài của bạn"} đã gửi đến giáo viên.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href={returnHref}>Về trang lớp</Link>
            </Button>
            {resultsShared && (
              <Button asChild className="w-full gap-2">
                <Link href={`/c/${shareToken}/session/${session.id}/results`}>
                  <Sparkles className="size-4" />
                  Xem kết quả các nhóm
                </Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  const returnHrefSafe =
    typeof window !== "undefined" ? `/c/${window.location.pathname.split("/")[2]}` : "/"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link href={returnHrefSafe}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{className}</p>
            <h1 className="font-heading font-semibold truncate">{session.title}</h1>
          </div>
          {running && session.ends_at && (
            <div
              className={`font-mono text-2xl font-bold tabular-nums rounded-lg px-2 py-1 ${
                remaining <= 15
                  ? "bg-destructive/10 text-destructive animate-pulse"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {formatDuration(Math.max(0, remaining))}
            </div>
          )}
          {ended && <span className="text-xs bg-muted px-2 py-1 rounded-md">Đã hết giờ</span>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {resultsShared && (
          <Card className="p-3 flex items-center gap-3 bg-accent/15 border-accent/40">
            <Sparkles className="size-5 text-accent-foreground shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Giáo viên đã chia sẻ kết quả</p>
              <p className="text-xs text-muted-foreground">Xem bài của tất cả các nhóm kèm chấm.</p>
            </div>
            <Button asChild size="sm" variant="secondary" className="gap-1">
              <Link href={`/c/${shareToken}/session/${session.id}/results`}>
                <Share2 className="size-3.5" />
                Xem
              </Link>
            </Button>
          </Card>
        )}

        {!selectedId && kind === "group" && needsSelfIdentify && (
          <div>
            <h2 className="font-heading font-semibold text-lg mb-2 flex items-center gap-2">
              <User className="w-5 h-5" /> Em là ai?
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Chọn tên em trong danh sách lớp. Hệ thống cần biết để gán điểm đúng em khi giáo viên chấm.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
              {students
                .slice()
                .sort((a, b) => (a.slot_number ?? 0) - (b.slot_number ?? 0))
                .map((st) => (
                  <Button
                    key={st.id}
                    variant="outline"
                    onClick={() => {
                      setSelfStudentId(st.id)
                      if (typeof window !== "undefined") {
                        localStorage.setItem(`tln_self_${session.id}`, st.id)
                      }
                    }}
                    className="h-auto py-3 flex-col items-start gap-0.5"
                  >
                    <span className="text-xs text-muted-foreground">Số {st.slot_number}</span>
                    <span className="font-medium text-sm text-left line-clamp-2">
                      {st.name || "Chưa đặt tên"}
                    </span>
                  </Button>
                ))}
            </div>
          </div>
        )}

        {!selectedId && kind === "group" && !needsSelfIdentify && (
          <div>
            {selfStudentId && (
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <User className="size-4" />
                <span>
                  Em là:{" "}
                  <strong className="text-foreground">
                    {students.find((s) => s.id === selfStudentId)?.name || "?"}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelfStudentId(null)
                    if (typeof window !== "undefined") {
                      localStorage.removeItem(`tln_self_${session.id}`)
                    }
                  }}
                  className="text-xs text-primary hover:underline ml-auto"
                >
                  Đổi
                </button>
              </div>
            )}
            <h2 className="font-heading font-semibold text-lg mb-2 flex items-center gap-2">
              <Users className="w-5 h-5" /> Chọn nhóm của bạn
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Bấm vào nhóm của mình. Tất cả các bạn trong cùng nhóm chọn cùng một ô.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {groups.map((g) => (
                <Button
                  key={g.id}
                  variant={g.claimed ? "secondary" : "default"}
                  disabled={busy || !running}
                  onClick={() => pickGroup(g.id)}
                  className="h-20 flex-col gap-1"
                >
                  <span className="font-heading font-semibold text-base">{g.label}</span>
                  {g.claimed && <span className="text-xs">Đã có người vào</span>}
                </Button>
              ))}
            </div>
            {!running && (
              <p className="text-sm text-muted-foreground mt-3">Chờ giáo viên bắt đầu phiên.</p>
            )}
          </div>
        )}

        {!selectedId && kind === "individual" && (
          <div>
            <h2 className="font-heading font-semibold text-lg mb-2 flex items-center gap-2">
              <User className="w-5 h-5" /> Chọn ô của bạn
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((s) => {
                const student = students.find((st) => st.id === s.student_id)
                return (
                  <Button
                    key={s.id}
                    variant="secondary"
                    disabled={busy || !running}
                    onClick={() => pickSlot(s.id, student?.id ?? null)}
                    className="h-16 flex-col gap-1 px-1"
                  >
                    <span className="text-xs text-muted-foreground">#{s.slot_number}</span>
                    <span className="text-xs truncate max-w-full">{student?.name ?? "Trống"}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {selectedId && (
          <div className="space-y-4">
            {!allowPaste && (
              <Card className="p-3 text-xs flex items-center gap-2 bg-accent/15 border-accent/40">
                <Ban className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  Giáo viên không cho phép dán nội dung từ nơi khác. Hãy tự gõ bài hoặc tải tệp lên.
                </span>
              </Card>
            )}

            <Tabs defaultValue="text">
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">
                  <FileText className="w-4 h-4 mr-2" /> Văn bản
                </TabsTrigger>
                <TabsTrigger value="files" className="flex-1">
                  <Upload className="w-4 h-4 mr-2" /> Tệp / Ảnh
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-2 mt-4">
                <Label className="text-base">Nội dung bài báo cáo</Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={(e) => {
                    if (!allowPaste) {
                      e.preventDefault()
                      toast.warning("Không thể dán nội dung. Hãy tự gõ nhé.")
                    }
                  }}
                  onDrop={(e) => {
                    if (!allowPaste) e.preventDefault()
                  }}
                  disabled={!running || busy}
                  rows={12}
                  placeholder="Gõ nội dung báo cáo của nhóm..."
                  className="font-sans text-lg leading-relaxed"
                  style={{ fontSize: "18px" }}
                />
                <p className="text-xs text-muted-foreground">
                  Chữ được hiển thị cỡ lớn để cả lớp xem rõ khi giáo viên chiếu lên.
                </p>
              </TabsContent>

              <TabsContent value="files" className="space-y-3 mt-4">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />

                {/* Drop zone nổi bật */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (!running) return
                    addFiles(e.dataTransfer.files)
                  }}
                  className={`rounded-xl border-2 border-dashed transition ${
                    dragOver
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  } p-6 flex flex-col items-center gap-3 text-center`}
                >
                  <div className="size-14 rounded-full bg-primary/15 text-primary grid place-items-center">
                    <Upload className="size-6" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-base">
                      Kéo-thả tệp vào đây hoặc chọn bên dưới
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ảnh (JPG/PNG/HEIC), PDF, Word (.docx), PowerPoint (.pptx)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                    <Button
                      variant="default"
                      className="h-14 flex-col gap-0.5"
                      disabled={!running || busy}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="w-5 h-5" />
                      <span className="text-xs">Chụp / chọn ảnh</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 flex-col gap-0.5"
                      disabled={!running || busy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs">Word / PPT / PDF</span>
                    </Button>
                  </div>
                </div>

                {staged.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {staged.length} tệp đang chờ nộp
                    </p>
                    <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {staged.map((s) => (
                        <li
                          key={s.id}
                          className="relative rounded-md border bg-card overflow-hidden aspect-square"
                        >
                          {s.previewUrl ? (
                            <img
                              src={s.previewUrl || "/placeholder.svg"}
                              alt={s.file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center gap-1 bg-muted/40">
                              <div className="text-muted-foreground">{iconFor(s.kind)}</div>
                              <p className="text-[10px] leading-tight line-clamp-2 break-all">
                                {s.file.name}
                              </p>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeStaged(s.id)}
                            className="absolute top-1 right-1 bg-card/90 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 border shadow"
                            aria-label={`Xóa ${s.file.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Button
              className="w-full h-14 text-base font-semibold"
              disabled={busy || !running || (!text.trim() && staged.length === 0)}
              onClick={() => handleSubmit(false)}
            >
              <Send className="w-5 h-5 mr-2" />
              {busy
                ? "Đang nộp..."
                : staged.length > 0
                  ? `Nộp bài (${staged.length} tệp)`
                  : "Nộp bài"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Bài của bạn sẽ tự động được nộp khi hết giờ.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
