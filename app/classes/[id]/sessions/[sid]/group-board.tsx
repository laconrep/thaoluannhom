"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  saveAnnotationAction,
  unlockGroupAction,
  togglePasteAction,
  shareResultsAction,
  toggleDownloadAction,
} from "@/app/actions"
import type {
  AnnotationRow,
  SessionGroupRow,
  SessionRow,
  SubmissionRow,
  AnnotationItem,
  SubmissionFile,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AnnotationEditor } from "@/components/annotation-editor"
import { TimerPanel } from "@/components/timer-panel"
import { Switch } from "@/components/ui/switch"
import { sounds, isSoundEnabled, setSoundEnabled } from "@/lib/sounds"
import { PresentationUpload } from "@/components/presentation-upload"
import { PresentationViewer, startPresentationMode } from "@/components/presentation-viewer"
import {
  ArrowLeft,
  Link as LinkIcon,
  CircleCheckBig,
  ClipboardList,
  Image as ImageIcon,
  FileText,
  Unlock,
  Presentation,
  File as FileIcon,
  Share2,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Check,
  Download,
  Maximize2,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react"

function getFiles(sub: SubmissionRow | undefined): SubmissionFile[] {
  if (!sub) return []
  if (Array.isArray(sub.files) && sub.files.length > 0) return sub.files
  if (sub.image_url) {
    return [
      {
        url: sub.image_url,
        name: "ảnh.jpg",
        kind: "image",
        mime: "image/jpeg",
        rotation: 0,
      },
    ]
  }
  return []
}

function FileThumb({ f }: { f: SubmissionFile }) {
  if (f.kind === "image") {
    return (
      <img
        src={f.url || "/placeholder.svg"}
        alt={f.name}
        className="w-full h-full object-cover"
        style={{ transform: `rotate(${f.rotation ?? 0}deg)` }}
      />
    )
  }
  const Icon = f.kind === "pptx" ? Presentation : f.kind === "docx" ? FileText : FileIcon
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1 bg-muted/40 text-muted-foreground">
      <Icon className="size-5" aria-hidden="true" />
      <span className="text-[10px] line-clamp-2 text-center break-all px-1">{f.name}</span>
    </div>
  )
}

export function GroupSessionBoard({
  classId,
  className,
  shareToken,
  session: initialSession,
  groups: initialGroups,
  submissions: initialSubs,
  annotations: initialAnns,
}: {
  classId: string
  className: string
  shareToken: string
  session: SessionRow
  groups: SessionGroupRow[]
  submissions: SubmissionRow[]
  annotations: AnnotationRow[]
}) {
  const [session, setSession] = useState(initialSession)
  const [groups, setGroups] = useState(initialGroups)
  const [subs, setSubs] = useState(initialSubs)
  const [anns, setAnns] = useState(initialAnns)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [slideshowIdx, setSlideshowIdx] = useState<number | null>(null) // chế độ trình chiếu cả lớp
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [soundOn, setSoundOn] = useState(false)
  const [projectionTimerStarted, setProjectionTimerStarted] = useState(false)
  const [liveMap, setLiveMap] = useState<Record<string, number>>({}) // groupId -> timestamp khi có update
  const [presentation, setPresentation] = useState<any>(null) // Presentation loaded
  const [isTeacher, setIsTeacher] = useState(false)
  const initRef = useRef(true)

  useEffect(() => {
    setSoundOn(isSoundEnabled())
    const openGroupFromProjection = (event: Event) => setOpenGroupId((event as CustomEvent<string>).detail)
    const startProjectionTimer = () => setProjectionTimerStarted(true)
    window.addEventListener("presentation-open-group", openGroupFromProjection)
    window.addEventListener("presentation-started", startProjectionTimer)
    return () => {
      window.removeEventListener("presentation-open-group", openGroupFromProjection)
      window.removeEventListener("presentation-started", startProjectionTimer)
    }
  }, [])

  // Check if user is teacher
  useEffect(() => {
    const checkTeacher = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: cls } = await supabase
          .from("classes")
          .select("teacher_id")
          .eq("id", classId)
          .single()
        setIsTeacher(cls?.teacher_id === user.id)
      }
    }
    checkTeacher()
  }, [classId])

  // Load existing presentation
  useEffect(() => {
    const loadPresentation = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("presentations")
          .select("*")
          .eq("session_id", session.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        
        if (error || !data) {
          return
        }
        
        setPresentation(data)
      } catch (err) {
        // Silently fail if table doesn't exist
      }
    }
    loadPresentation()
  }, [session.id])

  // Realtime với hiệu ứng live
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`sess-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (p: any) => p.new && setSession(p.new as SessionRow),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_groups",
          filter: `session_id=eq.${session.id}`,
        },
        (p: any) => {
          if (p.eventType === "UPDATE" && p.new) {
            setGroups((cur) => cur.map((g) => (g.id === p.new.id ? (p.new as SessionGroupRow) : g)))
            setLiveMap((m) => ({ ...m, [p.new.id]: Date.now() }))
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `session_id=eq.${session.id}`,
        },
        (p: any) => {
          if ((p.eventType === "INSERT" || p.eventType === "UPDATE") && p.new) {
            setSubs((cur) => {
              const idx = cur.findIndex((x) => x.id === p.new.id)
              if (idx >= 0) {
                const next = cur.slice()
                next[idx] = p.new as SubmissionRow
                return next
              }
              return [...cur, p.new as SubmissionRow]
            })
            if (p.new.session_group_id) {
              setLiveMap((m) => ({ ...m, [p.new.session_group_id]: Date.now() }))
            }
            if (!initRef.current && p.eventType === "INSERT" && isSoundEnabled()) {
              sounds.newSubmission()
              toast.success("Có nhóm mới nộp bài", { duration: 2000 })
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "annotations",
          filter: `session_id=eq.${session.id}`,
        },
        (p: any) => {
          if ((p.eventType === "INSERT" || p.eventType === "UPDATE") && p.new) {
            setAnns((cur) => {
              const idx = cur.findIndex((x) => x.id === p.new.id)
              if (idx >= 0) {
                const next = cur.slice()
                next[idx] = p.new as AnnotationRow
                return next
              }
              return [...cur, p.new as AnnotationRow]
            })
          }
        },
      )
      .subscribe()
    initRef.current = false
    return () => {
      supabase.removeChannel(ch)
    }
  }, [session.id])

  // Xóa live indicator sau vài giây
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setLiveMap((m) => {
        const next: Record<string, number> = {}
        for (const k in m) if (now - m[k] < 4000) next[k] = m[k]
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const subsByGroup = useMemo(() => {
    const m: Record<string, SubmissionRow> = {}
    for (const s of subs) if (s.session_group_id) m[s.session_group_id] = s
    return m
  }, [subs])

  const annsByGroup = useMemo(() => {
    const m: Record<string, AnnotationRow> = {}
    for (const a of anns) if (a.session_group_id) m[a.session_group_id] = a
    return m
  }, [anns])

  const openGroup = openGroupId ? groups.find((g) => g.id === openGroupId) : null
  const openSub = openGroup ? subsByGroup[openGroup.id] : null
  const openAnn = openGroup ? annsByGroup[openGroup.id] : null

  const slideshowGroup = slideshowIdx !== null ? groups[slideshowIdx] : null
  const slideshowSub = slideshowGroup ? subsByGroup[slideshowGroup.id] : null
  const slideshowAnn = slideshowGroup ? annsByGroup[slideshowGroup.id] : null

  // Shortcut phím cho slideshow
  useEffect(() => {
    if (slideshowIdx === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setSlideshowIdx((i) => (i === null ? 0 : (i + 1) % groups.length))
      else if (e.key === "ArrowLeft")
        setSlideshowIdx((i) => (i === null ? 0 : (i - 1 + groups.length) % groups.length))
      else if (e.key === "Escape") setSlideshowIdx(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [slideshowIdx, groups.length])

  function copyShareLink() {
    const url = `${window.location.origin}/c/${shareToken}/session/${session.id}`
    navigator.clipboard.writeText(url)
    toast.success("Đã sao chép link cho HS", { duration: 2000 })
  }

  function copyResultsLink() {
    const url = `${window.location.origin}/c/${shareToken}/session/${session.id}/results`
    navigator.clipboard.writeText(url)
    toast.success("Đã sao chép link xem kết quả", { duration: 2000 })
  }

  async function toggleShareResults() {
    const share = !session.results_shared_at
    await shareResultsAction(session.id, share)
    toast.success(share ? "Đã chia sẻ kết quả tới HS" : "Đã thu hồi chia sẻ")
  }

  const submittedCount = groups.filter((g) => subsByGroup[g.id]).length
  const claimedCount = groups.filter((g) => g.claimed).length

  const colsClass =
    groups.length <= 4
      ? "grid-cols-2"
      : groups.length <= 6
        ? "grid-cols-3"
        : groups.length <= 9
          ? "grid-cols-3"
          : "grid-cols-4"

  const mainContent = (
    <div className="-mx-4 -my-5">
      <div
        className={`grid gap-3 h-[calc(100svh-160px)] px-4 transition-[grid-template-columns] duration-200`}
        style={{
          gridTemplateColumns: sidebarOpen ? "260px 1fr" : "64px 1fr",
        }}
      >
        {/* SIDEBAR */}
        <aside className="flex flex-col gap-2 border rounded-xl bg-card p-2 overflow-auto no-scrollbar">
          <div className="flex items-center gap-1">
            {sidebarOpen && (
              <Link
                href={`/classes/${classId}/sessions`}
                className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mr-auto"
              >
                <ArrowLeft className="size-3" aria-hidden="true" />
                Tất cả phiên
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeftOpen className="size-4" />
              )}
            </Button>
          </div>

          {sidebarOpen ? (
            <>
              <h3 className="font-heading font-semibold text-sm leading-tight text-pretty line-clamp-2 mt-1">
                {session.title}
              </h3>
              <p className="text-xs text-muted-foreground">{className}</p>

              <TimerPanel
                sessionId={session.id}
                status={session.status}
                endsAt={session.ends_at}
                durationSeconds={session.duration_seconds}
                forceStart={projectionTimerStarted}
              />

              <div className="grid grid-cols-2 gap-1.5 mt-1">
                <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
                  <p className="text-lg font-heading font-bold tabular-nums leading-none">
                    {claimedCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">đã chọn</p>
                </div>
                <div className="rounded-md bg-primary/10 text-primary px-2 py-1.5 text-center">
                  <p className="text-lg font-heading font-bold tabular-nums leading-none">
                    {submittedCount}
                  </p>
                  <p className="text-[10px]">đã nộp</p>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={copyShareLink} className="gap-1 mt-1">
                <LinkIcon className="size-3" aria-hidden="true" />
                Copy link HS làm bài
              </Button>

              {/* Presentation upload */}
              {isTeacher && (
                <>
                  <div className="h-px bg-border my-1" />
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                    PowerPoint
                  </p>
                  <div className="presentation-upload">
                    <PresentationUpload
                      sessionId={session.id}
                      onUploadSuccess={(pres) => setPresentation(pres)}
                    />
                  </div>
                </>
              )}

              {/* Chế độ chiếu lớp slideshow */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => presentation ? startPresentationMode() : setSlideshowIdx(0)}
                className="gap-1"
                disabled={groups.length === 0}
              >
                <Presentation className="size-3" aria-hidden="true" />
                Chế độ chiếu lớp
              </Button>

              {/* Chia sẻ kết quả cho HS */}
              <div className="rounded-md border bg-accent/10 border-accent/40 p-2 flex flex-col gap-1.5 mt-1">
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="size-3.5 text-accent-foreground" aria-hidden="true" />
                  <span className="font-semibold">Chia sẻ kết quả cho HS</span>
                </div>
                <label className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="leading-tight">HS xem được 8 nhóm</span>
                  <Switch
                    checked={!!session.results_shared_at}
                    onCheckedChange={toggleShareResults}
                    aria-label="Bật chia sẻ kết quả"
                  />
                </label>
                {session.results_shared_at && (
                  <>
                    <label className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="leading-tight">Cho phép tải xuống</span>
                      <Switch
                        checked={session.allow_download}
                        onCheckedChange={(v) => toggleDownloadAction(session.id, v)}
                        aria-label="Cho phép tải xuống"
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={copyResultsLink}
                      className="gap-1 h-7 text-xs"
                    >
                      <Share2 className="size-3" />
                      Copy link kết quả
                    </Button>
                  </>
                )}
              </div>

              <label className="flex items-center justify-between gap-2 text-xs rounded-md border px-2 py-1.5 bg-muted/30 mt-1">
                <span className="leading-tight">Cho phép dán khi HS gõ</span>
                <Switch
                  checked={session.allow_paste}
                  onCheckedChange={(v) => togglePasteAction(session.id, v)}
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-xs rounded-md border px-2 py-1.5 bg-muted/30">
                <span className="leading-tight inline-flex items-center gap-1">
                  {soundOn ? (
                    <Volume2 className="size-3" />
                  ) : (
                    <VolumeX className="size-3" />
                  )}
                  Âm thanh báo
                </span>
                <Switch
                  checked={soundOn}
                  onCheckedChange={(v) => {
                    setSoundOn(v)
                    setSoundEnabled(v)
                  }}
                />
              </label>

              <div className="h-px bg-border my-1" />

              <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                Các nhóm ({groups.length})
              </p>
              <ul className="flex flex-col gap-1">
                {groups.map((g, idx) => {
                  const sub = subsByGroup[g.id]
                  const ann = annsByGroup[g.id]
                  const isLive = !!liveMap[g.id]
                  return (
                    <li key={g.id}>
                      <button
                        onClick={() => setOpenGroupId(g.id)}
                        className="w-full text-left rounded-md border bg-card hover:bg-muted/40 hover:border-primary/30 p-1.5 flex flex-col gap-0.5 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs">{g.label}</span>
                          {isLive && (
                            <span
                              className="size-1.5 rounded-full bg-primary animate-pulse"
                              aria-hidden="true"
                            />
                          )}
                          {ann?.score !== null && ann?.score !== undefined && (
                            <span className="ml-auto text-xs font-bold text-primary tabular-nums">
                              {ann.score}đ
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {g.claimed ? (
                            <>
                              <CircleCheckBig className="size-3 text-primary" aria-hidden="true" />
                              <span>Đã chọn</span>
                            </>
                          ) : (
                            <span>Chưa có nhóm</span>
                          )}
                          {sub && (
                            <span className="ml-auto text-primary inline-flex items-center gap-0.5">
                              <ClipboardList className="size-3" aria-hidden="true" />
                              Nộp
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            // Sidebar thu gọn — chỉ icon
            <div className="flex flex-col gap-1.5 items-center">
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => setSlideshowIdx(0)}
                title="Chế độ chiếu lớp"
              >
                <Presentation className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={copyShareLink}
                title="Copy link HS"
              >
                <LinkIcon className="size-4" />
              </Button>
              <div className="flex flex-col items-center gap-0.5 pt-2">
                <span className="text-xs font-bold tabular-nums">{submittedCount}</span>
                <span className="text-[9px] text-muted-foreground">nộp</span>
              </div>
            </div>
          )}
        </aside>

        {/* MAIN GRID */}
        <div className="overflow-auto">
          <div className={`grid ${colsClass} gap-2.5 auto-rows-fr h-full`}>
            {groups.map((g, idx) => {
              const sub = subsByGroup[g.id]
              const ann = annsByGroup[g.id]
              const files = getFiles(sub)
              const hasContent = files.length > 0 || !!sub?.text_content
              const isLive = !!liveMap[g.id]
              return (
                <Card
                  key={g.id}
                  className="overflow-hidden hover:ring-2 hover:ring-primary/40 transition cursor-pointer flex flex-col float-card"
                  onClick={() => setOpenGroupId(g.id)}
                >
                  <div className="border-b px-3 py-2 flex items-center justify-between gap-2 bg-card">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-heading font-semibold text-sm truncate">{g.label}</p>
                      {isLive && (
                        <span
                          className="size-2 rounded-full bg-primary animate-pulse shrink-0"
                          aria-hidden="true"
                          title="Đang hoạt động"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {ann?.score !== null && ann?.score !== undefined && (
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                          {ann.score} đ
                        </span>
                      )}
                      {g.claimed && (
                        <button
                          type="button"
                          title="Mở lại nhóm"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (
                              !confirm(
                                `Mở lại ${g.label}? Bài đã nộp và phần chấm sẽ bị xóa để nhóm khác vào chọn từ đầu.`,
                              )
                            )
                              return
                            unlockGroupAction(g.id, true)
                            toast("Đã mở lại " + g.label)
                          }}
                          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted"
                        >
                          <Unlock className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative flex-1 overflow-hidden bg-muted/20">
                    {files.length > 1 ? (
                      <div className="absolute inset-0 grid grid-cols-2 gap-[2px] bg-border">
                        {files.slice(0, 4).map((f, i) => (
                          <div key={i} className="relative overflow-hidden bg-muted/20">
                            <FileThumb f={f} />
                            {i === 3 && files.length > 4 && (
                              <div className="absolute inset-0 bg-black/50 text-white text-sm font-semibold grid place-items-center">
                                +{files.length - 3}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : files.length === 1 ? (
                      <div className="absolute inset-0">
                        <FileThumb f={files[0]} />
                      </div>
                    ) : sub?.text_content ? (
                      <div className="absolute inset-0 p-3 text-sm whitespace-pre-wrap overflow-hidden leading-relaxed">
                        {sub.text_content}
                      </div>
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground p-4 text-center">
                        {g.claimed ? "Chưa nộp bài" : "Chưa có nhóm chọn"}
                      </div>
                    )}
                    {hasContent && (
                      <span className="absolute bottom-1.5 right-1.5 bg-card/90 backdrop-blur rounded-full px-2 py-0.5 border text-[10px] flex items-center gap-1 shadow-sm">
                        {files.length > 0 ? (
                          <>
                            <ImageIcon className="size-3" aria-hidden="true" />
                            {files.length}
                          </>
                        ) : (
                          <FileText className="size-3" aria-hidden="true" />
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSlideshowIdx(idx)
                      }}
                      className="absolute top-1.5 right-1.5 bg-card/90 backdrop-blur rounded-md p-1 border text-muted-foreground hover:text-primary shadow-sm opacity-0 group-hover:opacity-100 transition"
                      title="Phóng to nhóm này để cả lớp xem"
                    >
                      <Maximize2 className="size-3" />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* Editor modal */}
      {openGroup && (
        <AnnotationEditor
          title={`${openGroup.label} — ${session.title}`}
          files={getFiles(openSub ?? undefined)}
          textContent={openSub?.text_content ?? null}
          initialData={(openAnn?.data ?? []) as AnnotationItem[]}
          initialScore={openAnn?.score ?? null}
          onSave={async (data, score) => {
            await saveAnnotationAction({
              sessionId: session.id,
              sessionGroupId: openGroup.id,
              data,
              score,
            })
            toast.success("Đã lưu", { duration: 1500 })
          }}
          onClose={() => setOpenGroupId(null)}
        />
      )}

      {/* Slideshow presentation mode */}
      {slideshowGroup && (
        <Slideshow
          group={slideshowGroup}
          sub={slideshowSub ?? null}
          ann={slideshowAnn ?? null}
          index={slideshowIdx ?? 0}
          total={groups.length}
          onPrev={() =>
            setSlideshowIdx((i) =>
              i === null ? 0 : (i - 1 + groups.length) % groups.length,
            )
          }
          onNext={() => setSlideshowIdx((i) => (i === null ? 0 : (i + 1) % groups.length))}
          onClose={() => setSlideshowIdx(null)}
        />
      )}
    </div>
  )

  // If presentation is loaded and teacher, wrap in PresentationViewer
  if (presentation && isTeacher) {
    return (
      <PresentationViewer
        presentationId={presentation.id}
        sessionId={session.id}
        isTeacher={isTeacher}
        groupCount={groups.length}
        groups={groups}
        submissions={subs}
      >
        {mainContent}
      </PresentationViewer>
    )
  }

  return mainContent
}

function Slideshow({
  group,
  sub,
  ann,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  group: SessionGroupRow
  sub: SubmissionRow | null
  ann: AnnotationRow | null
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const [fontSize, setFontSize] = useState(32)
  const files = getFiles(sub ?? undefined)

  return (
    <div className="fixed inset-0 z-50 presentation-mode flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-black/10 bg-white/95 backdrop-blur">
        <p className="font-heading font-bold text-2xl">{group.label}</p>
        {ann?.score !== null && ann?.score !== undefined && (
          <span className="rounded-full bg-primary/15 text-primary px-3 py-0.5 text-sm font-bold">
            {ann.score} đ
          </span>
        )}
        <span className="ml-auto text-sm text-neutral-500 tabular-nums">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-1 border rounded-md">
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.max(16, s - 4))}
            className="px-2 py-1 text-sm hover:bg-muted"
            aria-label="Giảm cỡ chữ"
          >
            A−
          </button>
          <span className="px-2 text-xs tabular-nums text-neutral-600">{fontSize}</span>
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.min(64, s + 4))}
            className="px-2 py-1 text-sm hover:bg-muted"
            aria-label="Tăng cỡ chữ"
          >
            A+
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
          <X className="size-4" /> Đóng
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6 relative">
        {files.length > 0 ? (
          <div className="grid gap-4 max-w-5xl mx-auto">
            {files.map((f, i) => (
              <div key={i} className="rounded-lg overflow-hidden border bg-white">
                {f.kind === "image" ? (
                  <img
                    src={f.url || "/placeholder.svg"}
                    alt={f.name}
                    className="w-full h-auto"
                    style={{ transform: `rotate(${f.rotation ?? 0}deg)` }}
                  />
                ) : (
                  <div className="p-10 flex flex-col items-center gap-2 text-muted-foreground">
                    <FileIcon className="size-10" />
                    <p className="text-sm">{f.name}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : sub?.text_content ? (
          <div
            className="max-w-5xl mx-auto whitespace-pre-wrap text-neutral-900 leading-relaxed"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.55 }}
          >
            {sub.text_content}
          </div>
        ) : (
          <div className="h-full grid place-items-center">
            <p className="text-2xl text-neutral-500">Nhóm chưa nộp bài</p>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <button
        type="button"
        onClick={onPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white border shadow hover:bg-muted grid place-items-center"
        aria-label="Nhóm trước"
      >
        <ChevronLeft className="size-6" />
      </button>
      <button
        type="button"
        onClick={onNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white border shadow hover:bg-muted grid place-items-center"
        aria-label="Nhóm kế tiếp"
      >
        <ChevronRight className="size-6" />
      </button>
    </div>
  )
}
