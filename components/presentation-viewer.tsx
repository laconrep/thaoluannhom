"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, Download, Link as LinkIcon, Presentation, QrCode, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { AnnotationEditor } from "@/components/annotation-editor"
import { GroupCardsGrid } from "@/components/group-card"
import { TimerPanel } from "@/components/timer-panel"
import { getFiles } from "@/lib/submission-files"
import { useCountdown, formatClock } from "@/lib/use-countdown"
import { endSessionAction, saveAnnotationAction } from "@/app/actions"
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
  barsOnCollapse?: boolean
  onSessionChanged?: (session: any) => void
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
  barsOnCollapse = false,
  onSessionChanged,
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
  const [closeTimer, setCloseTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
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
    }
    load()
  }, [presentationId, supabase, isTeacher])

  // Tạo signed URL 24h một lần để Office Online Viewer tải được file cả buổi học
  useEffect(() => {
    const storagePath = presentation?.storage_path ?? presentation?.file_path
    if (!storagePath) return

    let cancelled = false

    const createSignedUrl = async () => {
      const { data: signed, error } = await supabase.storage
        .from("presentations")
        .createSignedUrl(storagePath, 60 * 60 * 24) // 24 giờ, đủ dài cho một buổi học
      if (cancelled) return
      if (error) {
        console.error("Không tạo được signed URL cho presentation:", error)
        return
      }
      if (signed?.signedUrl) {
        setRawUrl(signed.signedUrl)
        setSourceUrl(
          `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signed.signedUrl)}`,
        )
      }
    }

    createSignedUrl()

    return () => {
      cancelled = true
    }
  }, [presentation?.storage_path, presentation?.file_path, supabase])

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

  // Khi phiên bắt đầu chạy (từ bất kỳ trạng thái nào: idle/ended -> running):
  // reset trạng thái chiếu để đồng hồ nổi và 8 thanh nhóm hoạt động lại như khi
  // bấm "Bắt đầu". Trước đây chỉ reset cho ended -> running nên phiên mới (idle
  // -> running) vẫn giữ projectionEnded từ phiên cũ và 8 thanh không hiện.
  const prevStatusRef = useRef(status)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== "running" && status === "running") {
      setProjectionEnded(false)
    }
    if (status === "ended") {
      setProjectionEnded(true)
      setBarsVisible(false)
    }
  }, [status])

  // Bật 8 thanh nhóm bất cứ khi nào drawer đóng và phiên đang chạy (hoặc đang
  // preview) mà chưa kết thúc chiếu. Không phụ thuộc thời điểm click thu drawer:
  // nếu status cập nhật sau khi collapse, effect này vẫn latch thanh lên.
  // Giữ guard !projectionEnded để không khôi phục lại trạng thái sau khi GV
  // bấm "Kết thúc phiên".
  useEffect(() => {
    if (!drawerOpen && (status === "running" || barsOnCollapse) && !projectionEnded) {
      setBarsVisible(true)
    }
  }, [drawerOpen, status, barsOnCollapse, projectionEnded])

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
    const p = document.exitFullscreen?.()
    if (p) p.catch(() => undefined)
    supabase
      .from("presentations")
      .update({ is_visible: false })
      .eq("id", presentationId)
      .then(() => undefined)
  }

  // Thu màn hình xổ ra: nếu phiên đang chạy hoặc đang xem/preview một phiên thì
  // bật 8 thanh nhóm (latch, không tắt khi mở lại drawer).
  // projectionEnded chỉ được reset khi phiên bắt đầu chạy (xem effect phía trên),
  // nên nút "Kết thúc phiên" không bị khôi phục lại khi thu drawer.
  function collapseDrawer() {
    setDrawerOpen(false)
    if (status === "running" || barsOnCollapse) {
      setBarsVisible(true)
    }
  }

  // Kết thúc phiên: tắt 8 thanh + đồng hồ nổi VÀ kết thúc phiên hoàn toàn trong
  // DB (status = ended). Trước đây chỉ tắt cục bộ nên khi mở lại trình chiếu,
  // phiên vẫn còn "running" khiến nút + thanh nhóm tự hiện trở lại.
  async function endProjection() {
    setBarsVisible(false)
    setProjectionEnded(true)
    try {
      const next = await endSessionAction(sessionId)
      if (next && onSessionChanged) onSessionChanged(next)
    } catch (err) {
      toast.error(`Không thể kết thúc phiên: ${(err as Error)?.message ?? "lỗi không xác định"}`)
    }
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

      {/* Đồng hồ phiên nổi góc phải — chỉ hiện khi phiên đang chạy */}
      {status === "running" && !projectionEnded && (
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
            onMouseEnter={() => {
              if (closeTimer) clearTimeout(closeTimer)
              setHoverTimer(setTimeout(() => setDrawerOpen(true), 1500))
            }}
            onMouseLeave={() => {
              if (hoverTimer) clearTimeout(hoverTimer)
            }}
          />

          {/* Drawer: giao việc cho nhóm + thẻ nhóm đầy đủ */}
          <div
            className={`absolute left-0 top-0 bottom-0 z-20 w-[min(880px,92vw)] bg-background text-foreground shadow-2xl transition-transform duration-300 flex flex-col ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            onMouseEnter={() => {
              if (closeTimer) clearTimeout(closeTimer)
            }}
            onMouseLeave={() => {
              if (hoverTimer) clearTimeout(hoverTimer)
              setCloseTimer(setTimeout(() => collapseDrawer(), 1000))
            }}
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
              {status === "running" && !projectionEnded && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1 ml-auto"
                  onClick={endProjection}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Kết thúc phiên
                </Button>
              )}
              <button
                type="button"
                onClick={collapseDrawer}
                aria-label="Thu gọn bảng nhóm"
                title="Thu màn hình"
                className="ml-auto rounded p-1.5 hover:bg-muted"
              >
                <ChevronLeft className="size-5" />
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
          {(status === "running" || barsOnCollapse) && barsVisible && !projectionEnded && (
            <div className="absolute inset-y-0 left-6 z-20 flex w-[3vw] flex-col justify-center gap-[4.4px] py-8">
              {orderedGroups.slice(0, 4).map((number) => {
                const group = groups.find((item) => item.group_number === number)
                const label = group?.label ?? `Nhóm ${number}`
                const submitted = hasSubmission(number)
                return (
                  <button
                    key={number}
                    onClick={() => openGroup(number)}
                    title={`${label}${submitted ? " - Đã nộp" : " - Chưa nộp"}`}
                    className={`h-[4vh] w-full rounded-r text-[9.6px] leading-[1.1] break-words text-center transition-colors ${
                      submitted
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-neutral-300/70 text-black border border-black/10 hover:bg-neutral-200/80"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Thanh nhóm bên phải (nhóm 5-8) */}
          {(status === "running" || barsOnCollapse) && barsVisible && !projectionEnded && (
            <div className="absolute inset-y-0 right-0 z-20 flex w-[3vw] flex-col justify-center gap-[4.4px] py-8">
              {orderedGroups.slice(4, 8).map((number) => {
                const group = groups.find((item) => item.group_number === number)
                const label = group?.label ?? `Nhóm ${number}`
                const submitted = hasSubmission(number)
                return (
                  <button
                    key={number}
                    onClick={() => openGroup(number)}
                    title={`${label}${submitted ? " - Đã nộp" : " - Chưa nộp"}`}
                    className={`h-[4vh] w-full rounded-l text-[9.6px] leading-[1.1] break-words text-center transition-colors ${
                      submitted
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-neutral-300/70 text-black border border-black/10 hover:bg-neutral-200/80"
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
                autoFullscreen
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
