"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronRight, Download, Link as LinkIcon, Presentation, QrCode, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { AnnotationEditor } from "@/components/annotation-editor"
import { GroupCardsGrid } from "@/components/group-card"
import { TimerPanel } from "@/components/timer-panel"
import { getFiles } from "@/lib/submission-files"
import { useCountdown, formatClock } from "@/lib/use-countdown"
import { saveAnnotationAction } from "@/app/actions"
import type { AnnotationItem, AnnotationRow, SubmissionRow } from "@/lib/types"

export interface PresentationViewerProps {
  presentationId: string
  sessionId: string
  isTeacher: boolean
  children: React.ReactNode
  groupCount: number
  submissions: any[]
  groups?: any[]
  annotations?: any[]
  shareLink?: string
  liveMap?: Record<string, number>
  status?: "idle" | "running" | "ended"
  endsAt?: string | null
  durationSeconds?: number
  board?: (openGroup: (groupNumber: number) => void) => React.ReactNode
}

function colsFor(count: number): string {
  if (count <= 4) return "grid-cols-2"
  if (count <= 9) return "grid-cols-3"
  return "grid-cols-4"
}

export function PresentationViewer({
  presentationId,
  sessionId,
  isTeacher,
  children,
  groupCount,
  submissions,
  groups = [],
  annotations = [],
  shareLink = "",
  liveMap = {},
  status = "idle",
  endsAt = null,
  durationSeconds = 600,
  board,
}: PresentationViewerProps) {
  const [presentation, setPresentation] = useState<any>(null)
  const [active, setActive] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [rawUrl, setRawUrl] = useState<string | null>(null)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [hoverTimer, setHoverTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [barsVisible, setBarsVisible] = useState(false)
  const [projectionEnded, setProjectionEnded] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const load = async () => {
      if (!presentationId) return
      const { data } = await supabase
        .from("presentations")
        .select("*")
        .eq("id", presentationId)
        .single()
      if (!data) return
      setPresentation(data)
      setRemainingSeconds(
        data.ends_at ? Math.max(0, Math.ceil((new Date(data.ends_at).getTime() - Date.now()) / 1000)) : null,
      )
      if (!isTeacher) setActive(Boolean(data.is_visible))
      const { data: signed } = await supabase.storage
        .from("presentations")
        .createSignedUrl(data.storage_path ?? data.file_path, 3600)
      if (signed?.signedUrl) {
        setRawUrl(signed.signedUrl)
        setSourceUrl(
          `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signed.signedUrl)}`,
        )
      }
    }
    load()
  }, [presentationId, supabase, isTeacher])

  useEffect(() => {
    if (!presentationId) return
    const channel = supabase
      .channel(`presentation-${presentationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "presentations",
          filter: `id=eq.${presentationId}`,
        },
        (payload: any) => {
          setPresentation(payload.new)
          if (!isTeacher) setActive(Boolean(payload.new?.is_visible))
          setRemainingSeconds(
            payload.new?.ends_at
              ? Math.max(0, Math.ceil((new Date(payload.new.ends_at).getTime() - Date.now()) / 1000))
              : null,
          )
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [presentationId, supabase, isTeacher])

  useEffect(() => {
    if (!active || !presentation?.ends_at) return
    const tick = () =>
      setRemainingSeconds(
        Math.max(0, Math.ceil((new Date(presentation.ends_at).getTime() - Date.now()) / 1000)),
      )
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [active, presentation?.ends_at])

  useEffect(() => {
    const start = () => startPresentation()
    window.addEventListener("presentation-start", start)
    return () => window.removeEventListener("presentation-start", start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationId])

  const subsByGroup = useMemo(() => {
    const m: Record<string, SubmissionRow> = {}
    for (const s of submissions) if (s.session_group_id) m[s.session_group_id] = s
    return m
  }, [submissions])

  const sessionLeft = useCountdown(status === "running" ? endsAt : null, status)

  const annsByGroup = useMemo(() => {
    const m: Record<string, AnnotationRow> = {}
    for (const a of annotations) if (a.session_group_id) m[a.session_group_id] = a
    return m
  }, [annotations])

  const orderedGroups = Array.from({ length: Math.max(groupCount, 8) }, (_, i) => i + 1)
  const hasSubmission = (number: number) => {
    const group = groups.find((item) => item.group_number === number)
    return group ? submissions.some((item) => item.session_group_id === group.id) : false
  }

  function startPresentation() {
    setActive(true)
    const p = document.documentElement.requestFullscreen?.()
    if (p) p.catch(() => undefined)
    supabase
      .from("presentations")
      .update({ is_visible: true })
      .eq("id", presentationId)
      .then(() => undefined)
  }

  function stopPresentation() {
    setActive(false)
    setDrawerOpen(false)
    setShowQr(false)
    setOpenGroupId(null)
    setBarsVisible(false)
    setProjectionEnded(false)
    const p = document.exitFullscreen?.()
    if (p) p.catch(() => undefined)
    supabase
      .from("presentations")
      .update({ is_visible: false })
      .eq("id", presentationId)
      .then(() => undefined)
  }

  // Thu màn hình xổ ra: nếu phiên đang chạy thì bật 8 thanh nhóm (latch, không tắt khi mở lại drawer)
  function collapseDrawer() {
    setDrawerOpen(false)
    if (status === "running") setBarsVisible(true)
  }

  // Kết thúc phiên: chỉ tắt 8 thanh + đồng hồ nổi, phiên vẫn chạy
  function endProjection() {
    setBarsVisible(false)
    setProjectionEnded(true)
  }

  const openGroup = (number: number) => {
    const sessionGroup = groups.find((item) => item.group_number === number)
    if (sessionGroup) {
      setOpenGroupId(sessionGroup.id)
      setDrawerOpen(false)
    }
  }

  const copyLink = () => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
    toast.success("Đã sao chép link HS làm bài", { duration: 2000 })
  }

  const openGroupRow = openGroupId ? groups.find((g) => g.id === openGroupId) ?? null : null
  const openSub = openGroupRow ? subsByGroup[openGroupRow.id] : null
  const openAnn = openGroupRow ? annsByGroup[openGroupRow.id] : null

  if (!presentation) return <>{children}</>
  if (!active)
    return (
      <div className="relative min-h-full">
        {children}
        {isTeacher && (
          <Button
            onClick={startPresentation}
            className="fixed bottom-5 right-5 z-40 gap-2"
          >
            <Presentation className="size-4" />
            Trình chiếu PowerPoint
          </Button>
        )}
      </div>
    )

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white">
      {remainingSeconds !== null && (
        <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-md bg-black/75 px-4 py-2 font-mono text-xl tabular-nums">
          {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
          {String(remainingSeconds % 60).padStart(2, "0")}
        </div>
      )}

      {/* Đồng hồ phiên nổi góc phải */}
      {status !== "idle" && !projectionEnded && (
        <div
          className="absolute right-4 top-16 z-30 flex items-center justify-center rounded-full border-4 border-green-500 bg-transparent font-mono text-red-500 font-bold tabular-nums"
          style={{ width: "min(5vw, 5vh)", height: "min(5vw, 5vh)", fontSize: "min(1.4vw, 1.4vh)" }}
          title="Thời gian còn lại của phiên thảo luận"
        >
          {formatClock(sessionLeft)}
        </div>
      )}
      {sourceUrl ? (
        <iframe
          title={presentation.file_name}
          src={sourceUrl}
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
        />
      ) : (
        <div className="grid h-full place-items-center">Đang mở PowerPoint…</div>
      )}

      {isTeacher && (
        <>
          {/* Left hover zone */}
          <div
            className="absolute left-0 top-0 bottom-0 w-6 z-10"
            onMouseEnter={() =>
              setHoverTimer(setTimeout(() => setDrawerOpen(true), 2000))
            }
            onMouseLeave={() => {
              if (hoverTimer) clearTimeout(hoverTimer)
            }}
          />

          {/* Drawer: giao việc cho nhóm + thẻ nhóm đầy đủ */}
          <div
            className={`absolute left-0 top-0 bottom-0 z-20 w-[min(880px,92vw)] bg-background text-foreground shadow-2xl transition-transform duration-300 flex flex-col ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center gap-2 border-b p-3">
              <strong>Giao việc cho nhóm</strong>
              {shareLink && (
                <>
                  <Button variant="outline" size="sm" className="gap-1" onClick={copyLink}>
                    <LinkIcon className="size-3.5" />
                    Link HS làm bài
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowQr(true)}>
                    <QrCode className="size-3.5" />
                    QR code
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={collapseDrawer}
                aria-label="Thu gọn bảng nhóm"
                className="ml-auto rounded p-1.5 hover:bg-muted"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {board ? (
                board(openGroup)
              ) : (
                <>
                  <div className="p-3 pb-0">
                    <TimerPanel
                      sessionId={sessionId}
                      status={status}
                      endsAt={endsAt}
                      durationSeconds={durationSeconds}
                    />
                  </div>
                  <div className="p-3">
                    <GroupCardsGrid
                      groups={groups}
                      subsByGroup={subsByGroup}
                      annsByGroup={annsByGroup}
                      liveMap={liveMap}
                      onOpen={(id) => {
                        setOpenGroupId(id)
                        setDrawerOpen(false)
                      }}
                      colsClass={colsFor(groups.length)}
                    />
                  </div>
                </>
              )}
            </div>
            {/* Kết thúc phiên: tắt 8 thanh nhóm + đồng hồ nổi, phiên vẫn chạy */}
            <div className="border-t p-2">
              <Button variant="destructive" size="sm" className="w-full gap-1" onClick={endProjection}>
                <X className="size-3.5" aria-hidden="true" />
                Kết thúc phiên
              </Button>
            </div>
          </div>

          {/* QR modal */}
          {showQr && shareLink && (
            <div
              className="absolute inset-0 z-30 grid place-items-center bg-black/60"
              onClick={() => setShowQr(false)}
            >
              <div
                className="bg-white text-foreground rounded-xl p-5 flex flex-col items-center gap-3 max-w-[90vw]"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-heading font-semibold">Quét QR để HS mở link nộp bài</p>
                <QRCodeSVG value={shareLink} size={220} />
                <p className="text-xs text-muted-foreground break-all text-center max-w-[280px]">
                  {shareLink}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={copyLink}>
                    <LinkIcon className="size-3.5" />
                    Copy link
                  </Button>
                  <Button size="sm" onClick={() => setShowQr(false)}>
                    Đóng
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Thanh nhóm bên trái (nhóm 1-4) */}
          {barsVisible && !projectionEnded && (
            <div className="absolute inset-y-0 left-6 z-20 flex w-[2.5vw] flex-col justify-center gap-1 py-8">
              {orderedGroups.slice(0, 4).map((number) => {
                const group = groups.find((item) => item.group_number === number)
                const label = group?.label ?? `Nhóm ${number}`
                const submitted = hasSubmission(number)
                return (
                  <button
                    key={number}
                    onClick={() => openGroup(number)}
                    title={`${label}${submitted ? " - Đã nộp" : " - Chưa nộp"}`}
                    className={`h-[3.333vh] w-full rounded-r text-[8px] leading-[1.1] break-words text-center transition-colors ${
                      submitted
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-white/15 text-white/80 border border-white/20 hover:bg-white/25"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Thanh nhóm bên phải (nhóm 5-8) */}
          {barsVisible && !projectionEnded && (
            <div className="absolute inset-y-0 right-0 z-20 flex w-[2.5vw] flex-col justify-center gap-1 py-8">
              {orderedGroups.slice(4, 8).map((number) => {
                const group = groups.find((item) => item.group_number === number)
                const label = group?.label ?? `Nhóm ${number}`
                const submitted = hasSubmission(number)
                return (
                  <button
                    key={number}
                    onClick={() => openGroup(number)}
                    title={`${label}${submitted ? " - Đã nộp" : " - Chưa nộp"}`}
                    className={`h-[3.333vh] w-full rounded-l text-[8px] leading-[1.1] break-words text-center transition-colors ${
                      submitted
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-white/15 text-white/80 border border-white/20 hover:bg-white/25"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Nút đóng trình chiếu */}
          <button
            type="button"
            onClick={stopPresentation}
            aria-label="Đóng trình chiếu"
            className="absolute right-3 top-3 z-30 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <X className="size-4" />
          </button>

          {/* Fallback: tải file gốc nếu trình xem online lỗi */}
          {rawUrl && (
            <a
              href={rawUrl}
              target="_blank"
              rel="noreferrer"
              download={presentation.file_name}
              title="Nếu trang PowerPoint không hiển thị, hãy mở/tải file gốc"
              className="absolute left-3 bottom-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80"
            >
              <Download className="size-3.5" />
              Tải file gốc
            </a>
          )}

          {/* Công cụ chấm/sửa nổi trên PowerPoint */}
          {openGroupRow && (
            <div className="absolute inset-0 z-40">
              <AnnotationEditor
                title={`${openGroupRow.label} — ${presentation.file_name ?? ""}`}
                files={getFiles(openSub ?? undefined)}
                textContent={openSub?.text_content ?? null}
                initialData={(openAnn?.data ?? []) as AnnotationItem[]}
                initialScore={openAnn?.score ?? null}
                onSave={async (data, score) => {
                  await saveAnnotationAction({
                    sessionId,
                    sessionGroupId: openGroupRow.id,
                    data,
                    score,
                  })
                  toast.success("Đã lưu", { duration: 1500 })
                }}
                onClose={() => setOpenGroupId(null)}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function startPresentationMode() {
  window.dispatchEvent(new Event("presentation-start"))
  document.documentElement.requestFullscreen?.().catch(() => undefined)
}
