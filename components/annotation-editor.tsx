"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { AnnotationItem, SubmissionFile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFullscreen } from "@/lib/use-fullscreen"
import { cn } from "@/lib/utils"
import {
  Pen,
  Highlighter,
  Underline,
  Type,
  Undo2,
  Trash2,
  Save,
  X,
  Check,
  MoveDiagonal,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  RotateCcw,
  FileText,
  Presentation,
  File as FileIcon,
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Stamp,
  Hand,
  PresentationIcon,
  Eye,
} from "lucide-react"

const COLORS = [
  { name: "Đỏ", value: "#dc2626" },
  { name: "Xanh", value: "#2563eb" },
  { name: "Vàng", value: "#eab308" },
  { name: "Đen", value: "#111827" },
]

const STAMPS: { label: string; color: string }[] = [
  { label: "✓ Tốt", color: "#16a34a" },
  { label: "★ Xuất sắc", color: "#ca8a04" },
  { label: "⚠ Xem lại", color: "#ea580c" },
  { label: "✗ Sai", color: "#dc2626" },
]

type Tool = "pen" | "highlight" | "underline" | "text" | "stamp" | "pan"
type TextItem = Extract<AnnotationItem, { kind: "text" }>

function officeEmbed(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

function fileIcon(kind: string) {
  if (kind === "pptx") return Presentation
  if (kind === "docx") return FileText
  return FileIcon
}

export function AnnotationEditor({
  title,
  files,
  textContent,
  initialData,
  initialScore,
  maxScore = 10,
  onSave,
  onClose,
}: {
  title: string
  files: SubmissionFile[]
  textContent: string | null
  initialData: AnnotationItem[]
  initialScore: number | null
  maxScore?: number
  onSave: (data: AnnotationItem[], score: number | null) => Promise<void> | void
  onClose: () => void
}) {
  const hasFiles = files.length > 0
  const hasText = !!textContent && textContent.trim().length > 0
  const [currentIdx, setCurrentIdx] = useState<number>(hasFiles ? 0 : -1)
  const [rotations, setRotations] = useState<number[]>(() =>
    files.map((f) => f.rotation ?? 0),
  )
  useEffect(() => {
    setRotations(files.map((f) => f.rotation ?? 0))
  }, [files])

  const [items, setItems] = useState<AnnotationItem[]>(initialData)
  const [history, setHistory] = useState<AnnotationItem[][]>([])
  const [tool, setTool] = useState<Tool>("pen")
  const [color, setColor] = useState(COLORS[0].value)
  const [stampIdx, setStampIdx] = useState(0)
  const [score, setScore] = useState<string>(initialScore?.toString() ?? "")
  const [saving, setSaving] = useState(false)
  const [pendingText, setPendingText] = useState<{ x: number; y: number; text: string } | null>(
    null,
  )
  const [selectedTextIdx, setSelectedTextIdx] = useState<number | null>(null)
  const [presentationMode, setPresentationMode] = useState(false)
  const [textFontSize, setTextFontSize] = useState(18) // dành cho presentation chữ to
  const [zoomLevel, setZoomLevel] = useState(1) // 0.5 → 3
  const [showToolbar, setShowToolbar] = useState(true)
  const toolbarHideTimer = useRef<any>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<{ active: boolean; startX: number; startY: number; scrollX: number; scrollY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    scrollX: 0,
    scrollY: 0,
  })

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef)

  const currentFile = currentIdx >= 0 ? files[currentIdx] : null
  const currentRotation = currentIdx >= 0 ? rotations[currentIdx] ?? 0 : 0
  const isImage = currentFile?.kind === "image"
  const isPdf = currentFile?.kind === "pdf"
  const isOffice = currentFile?.kind === "docx" || currentFile?.kind === "pptx"
  const canAnnotate = isImage || currentIdx === -1
  const annotationKey = currentIdx

  const filteredItems = useMemo(() => {
    return items
      .map((it, origIdx) => ({ it, origIdx }))
      .filter(({ it }) => (it.fileIndex ?? -1) === annotationKey)
  }, [items, annotationKey])

  const drawingRef = useRef<{
    active: boolean
    origIdx: number
    start: { x: number; y: number } | null
  }>({
    active: false,
    origIdx: -1,
    start: null,
  })

  const textDragRef = useRef<{
    mode: "move" | "resize" | null
    origIdx: number
    startX: number
    startY: number
    original: TextItem | null
  }>({ mode: null, origIdx: -1, startX: 0, startY: 0, original: null })

  function pushHistory() {
    setHistory((h) => [...h, items])
  }
  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setItems(prev)
      return h.slice(0, -1)
    })
  }
  function clearAll() {
    if (!confirm("Xóa toàn bộ ghi chú trên tệp này?")) return
    pushHistory()
    setItems((cur) => cur.filter((it) => (it.fileIndex ?? -1) !== annotationKey))
    setSelectedTextIdx(null)
  }

  // Chuyển tọa độ client -> tọa độ trong hệ unscaled của surface
  function localXY(clientX: number, clientY: number) {
    const rect = surfaceRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / zoomLevel,
      y: (clientY - rect.top) / zoomLevel,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "pan") {
      const vp = viewportRef.current
      if (!vp) return
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        scrollX: vp.scrollLeft,
        scrollY: vp.scrollTop,
      }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }

    if (!canAnnotate || pendingText) return
    setSelectedTextIdx(null)
    const { x, y } = localXY(e.clientX, e.clientY)

    if (tool === "text") {
      setPendingText({ x, y, text: "" })
      return
    }
    if (tool === "stamp") {
      pushHistory()
      const stamp = STAMPS[stampIdx]
      setItems((cur) => [
        ...cur,
        {
          kind: "stamp",
          label: stamp.label,
          color: stamp.color,
          x,
          y,
          fontSize: 28,
          fileIndex: annotationKey,
        },
      ])
      return
    }
    pushHistory()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    if (tool === "pen") {
      const item: AnnotationItem = {
        kind: "path",
        color,
        width: 3,
        points: [{ x, y }],
        fileIndex: annotationKey,
      }
      setItems((cur) => {
        const n = [...cur, item]
        drawingRef.current = { active: true, origIdx: n.length - 1, start: { x, y } }
        return n
      })
    } else if (tool === "highlight") {
      const item: AnnotationItem = {
        kind: "highlight",
        color,
        x,
        y,
        w: 0,
        h: 0,
        fileIndex: annotationKey,
      }
      setItems((cur) => {
        const n = [...cur, item]
        drawingRef.current = { active: true, origIdx: n.length - 1, start: { x, y } }
        return n
      })
    } else if (tool === "underline") {
      const item: AnnotationItem = {
        kind: "underline",
        color,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        fileIndex: annotationKey,
      }
      setItems((cur) => {
        const n = [...cur, item]
        drawingRef.current = { active: true, origIdx: n.length - 1, start: { x, y } }
        return n
      })
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current.active) {
      const vp = viewportRef.current
      if (!vp) return
      vp.scrollLeft = panRef.current.scrollX - (e.clientX - panRef.current.startX)
      vp.scrollTop = panRef.current.scrollY - (e.clientY - panRef.current.startY)
      return
    }
    if (!drawingRef.current.active) return
    const { x, y } = localXY(e.clientX, e.clientY)
    const origIdx = drawingRef.current.origIdx
    setItems((cur) => {
      const next = [...cur]
      const item = next[origIdx]
      if (!item) return cur
      if (item.kind === "path") {
        next[origIdx] = { ...item, points: [...item.points, { x, y }] }
      } else if (item.kind === "highlight") {
        const s = drawingRef.current.start!
        next[origIdx] = {
          ...item,
          x: Math.min(s.x, x),
          y: Math.min(s.y, y),
          w: Math.abs(x - s.x),
          h: Math.abs(y - s.y),
        }
      } else if (item.kind === "underline") {
        next[origIdx] = { ...item, x2: x, y2: y }
      }
      return next
    })
  }

  function onPointerUp() {
    drawingRef.current = { active: false, origIdx: -1, start: null }
    panRef.current.active = false
  }

  function confirmText() {
    if (!pendingText) return
    const t = pendingText.text.trim()
    if (t) {
      pushHistory()
      setItems((cur) => {
        const next = [
          ...cur,
          {
            kind: "text" as const,
            color,
            x: pendingText.x,
            y: pendingText.y,
            text: t,
            fontSize: 20,
            fileIndex: annotationKey,
          },
        ]
        setSelectedTextIdx(next.length - 1)
        return next
      })
    }
    setPendingText(null)
  }

  function beginTextDrag(e: React.PointerEvent, origIdx: number, mode: "move" | "resize") {
    e.stopPropagation()
    const it = items[origIdx]
    if (!it || it.kind !== "text") return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pushHistory()
    setSelectedTextIdx(origIdx)
    textDragRef.current = {
      mode,
      origIdx,
      startX: e.clientX,
      startY: e.clientY,
      original: it as TextItem,
    }
  }

  function onTextPointerMove(e: React.PointerEvent) {
    const d = textDragRef.current
    if (!d.mode || d.origIdx < 0 || !d.original) return
    const dx = (e.clientX - d.startX) / zoomLevel
    const dy = (e.clientY - d.startY) / zoomLevel
    setItems((cur) => {
      const next = [...cur]
      const cur0 = next[d.origIdx]
      if (!cur0 || cur0.kind !== "text") return cur
      if (d.mode === "move") {
        next[d.origIdx] = { ...cur0, x: d.original!.x + dx, y: d.original!.y + dy }
      } else {
        const delta = (dx + dy) / 2
        const nf = Math.max(10, Math.min(120, Math.round(d.original!.fontSize + delta / 2)))
        next[d.origIdx] = { ...cur0, fontSize: nf }
      }
      return next
    })
  }

  function onTextPointerUp() {
    textDragRef.current = { mode: null, origIdx: -1, startX: 0, startY: 0, original: null }
  }

  function deleteSelectedText() {
    if (selectedTextIdx === null) return
    pushHistory()
    setItems((cur) => cur.filter((_, i) => i !== selectedTextIdx))
    setSelectedTextIdx(null)
  }

  function changeFontSelected(delta: number) {
    if (selectedTextIdx === null) return
    pushHistory()
    setItems((cur) => {
      const next = [...cur]
      const it = next[selectedTextIdx]
      if (!it || it.kind !== "text") return cur
      next[selectedTextIdx] = {
        ...it,
        fontSize: Math.max(10, Math.min(120, it.fontSize + delta)),
      }
      return next
    })
  }

  function rotateCurrent(delta: number) {
    if (currentIdx < 0) return
    setRotations((r) => {
      const n = [...r]
      n[currentIdx] = (((n[currentIdx] ?? 0) + delta) % 360 + 360) % 360
      return n
    })
  }

  async function handleSave() {
    setSaving(true)
    const sc = score.trim() === "" ? null : Number(score)
    await onSave(items, Number.isFinite(sc as number) ? (sc as number) : null)
    setSaving(false)
  }

  // Zoom bằng Ctrl + wheel
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoomLevel((z) => {
        const next = Math.max(0.5, Math.min(3, z - e.deltaY / 500))
        return Math.round(next * 100) / 100
      })
    }
    vp.addEventListener("wheel", onWheel, { passive: false })
    return () => vp.removeEventListener("wheel", onWheel)
  }, [])

  // Phím tắt
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Escape") {
        if (pendingText) setPendingText(null)
        else if (selectedTextIdx !== null) setSelectedTextIdx(null)
        else if (presentationMode) setPresentationMode(false)
        else if (isFullscreen) toggleFullscreen()
        else onClose()
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedTextIdx !== null &&
        !pendingText
      ) {
        deleteSelectedText()
      }
      if (e.key === "ArrowLeft" && files.length > 1) setCurrentIdx((i) => Math.max(0, i - 1))
      if (e.key === "ArrowRight" && files.length > 1)
        setCurrentIdx((i) => Math.min(files.length - 1, i + 1))
      if (e.key === "f" || e.key === "F") toggleFullscreen()
      if (e.key === "0") setZoomLevel(1)
      if (e.key === "+" || e.key === "=") setZoomLevel((z) => Math.min(3, z + 0.25))
      if (e.key === "-") setZoomLevel((z) => Math.max(0.5, z - 0.25))
      if (e.key === "p" || e.key === "P") setPresentationMode((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingText, selectedTextIdx, files.length, presentationMode, isFullscreen])

  // Tự ẩn toolbar sau vài giây không dùng
  function kickToolbar() {
    setShowToolbar(true)
    if (toolbarHideTimer.current) clearTimeout(toolbarHideTimer.current)
    toolbarHideTimer.current = setTimeout(() => setShowToolbar(false), 4000)
  }
  useEffect(() => {
    kickToolbar()
    return () => {
      if (toolbarHideTimer.current) clearTimeout(toolbarHideTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cursor =
    tool === "pan"
      ? panRef.current.active
        ? "grabbing"
        : "grab"
      : tool === "text"
        ? "text"
        : canAnnotate
          ? "crosshair"
          : "default"

  return (
    <div
      ref={rootRef}
      className={cn(
        "fixed inset-0 z-50 bg-background flex flex-col",
        isFullscreen && "inset-0",
        presentationMode && "presentation-mode",
      )}
      onMouseMove={kickToolbar}
    >
      {/* Floating toolbar pill */}
      {!presentationMode && (
        <div
          className={cn(
            "absolute top-3 left-1/2 -translate-x-1/2 z-30 transition-all duration-300",
            showToolbar ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none",
          )}
        >
          <div className="bg-card/95 backdrop-blur border rounded-full shadow-lg px-2 py-1.5 flex items-center gap-1 flex-wrap max-w-[95vw]">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-8 rounded-full"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </Button>
            <div className="h-6 w-px bg-border" />

            {/* Tools */}
            <div className="flex items-center gap-0.5">
              <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} label="Bút (P)" disabled={!canAnnotate}>
                <Pen className="size-4" />
              </ToolBtn>
              <ToolBtn active={tool === "highlight"} onClick={() => setTool("highlight")} label="Tô màu" disabled={!canAnnotate}>
                <Highlighter className="size-4" />
              </ToolBtn>
              <ToolBtn active={tool === "underline"} onClick={() => setTool("underline")} label="Gạch chân" disabled={!canAnnotate}>
                <Underline className="size-4" />
              </ToolBtn>
              <ToolBtn active={tool === "text"} onClick={() => setTool("text")} label="Chèn chữ" disabled={!canAnnotate}>
                <Type className="size-4" />
              </ToolBtn>
              <ToolBtn active={tool === "stamp"} onClick={() => setTool("stamp")} label="Stamp" disabled={!canAnnotate}>
                <Stamp className="size-4" />
              </ToolBtn>
              <ToolBtn active={tool === "pan"} onClick={() => setTool("pan")} label="Kéo">
                <Hand className="size-4" />
              </ToolBtn>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Stamps picker (chỉ khi tool = stamp) */}
            {tool === "stamp" && (
              <>
                <div className="flex items-center gap-0.5">
                  {STAMPS.map((s, i) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setStampIdx(i)}
                      className={cn(
                        "px-2 h-8 rounded-md text-xs font-semibold whitespace-nowrap transition",
                        stampIdx === i ? "ring-2 ring-offset-1 ring-primary" : "hover:bg-muted",
                      )}
                      style={{ color: s.color }}
                      title={`Stamp ${s.label}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="h-6 w-px bg-border" />
              </>
            )}

            {/* Colors (chỉ khi không phải stamp) */}
            {tool !== "stamp" && tool !== "pan" && (
              <>
                <div className="flex items-center gap-1">
                  {COLORS.map((c) => {
                    const active = color === c.value
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        aria-label={c.name}
                        title={c.name}
                        className={cn(
                          "size-6 rounded-full transition shadow-sm grid place-items-center",
                          active ? "ring-2 ring-offset-1 ring-foreground scale-110" : "hover:scale-110",
                        )}
                        style={{ backgroundColor: c.value }}
                      >
                        {active ? (
                          <Check
                            className="size-3"
                            style={{ color: c.value === "#eab308" ? "#111827" : "#ffffff" }}
                          />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
                <div className="h-6 w-px bg-border" />
              </>
            )}

            {/* Undo / clear / rotate */}
            <Button variant="ghost" size="icon" onClick={undo} disabled={history.length === 0} className="size-8 rounded-full" aria-label="Hoàn tác">
              <Undo2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={clearAll} className="size-8 rounded-full" aria-label="Xóa hết">
              <Trash2 className="size-4" />
            </Button>
            {isImage && (
              <>
                <Button variant="ghost" size="icon" onClick={() => rotateCurrent(-90)} className="size-8 rounded-full" aria-label="Xoay trái">
                  <RotateCcw className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => rotateCurrent(90)} className="size-8 rounded-full" aria-label="Xoay phải">
                  <RotateCw className="size-4" />
                </Button>
              </>
            )}

            <div className="h-6 w-px bg-border" />

            {/* Zoom */}
            <Button variant="ghost" size="icon" onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))} className="size-8 rounded-full" aria-label="Thu nhỏ">
              <ZoomOut className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="text-xs tabular-nums min-w-[52px] px-1.5 py-1 rounded hover:bg-muted"
              title="Vừa màn hình (phím 0)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <Button variant="ghost" size="icon" onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))} className="size-8 rounded-full" aria-label="Phóng to">
              <ZoomIn className="size-4" />
            </Button>

            <div className="h-6 w-px bg-border" />

            {/* Presentation + fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPresentationMode((v) => !v)}
              className="size-8 rounded-full"
              aria-label="Chế độ trình chiếu (P)"
              title="Chế độ trình chiếu"
            >
              <PresentationIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="size-8 rounded-full"
              aria-label="Toàn màn hình (F)"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize className="size-4" />}
            </Button>

            <div className="h-6 w-px bg-border" />

            {/* Score + Save */}
            <div className="flex items-center gap-1">
              <Input
                className="w-14 h-8 text-sm"
                type="number"
                min={0}
                max={maxScore}
                step={0.25}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="—"
                aria-label="Điểm"
              />
              <span className="text-xs text-muted-foreground">/{maxScore}</span>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-full gap-1.5 h-8 px-3">
              <Save className="size-3.5" />
              {saving ? "Lưu..." : "Lưu"}
            </Button>
          </div>

          {/* Title + text resize khi đang ở chế độ văn bản */}
          <div className="mt-1.5 text-center">
            <div className="inline-flex items-center gap-2 bg-card/90 backdrop-blur rounded-full px-3 py-1 text-xs text-muted-foreground border shadow-sm">
              <span className="truncate max-w-[40ch]">{title}</span>
              {currentIdx === -1 && hasText && (
                <span className="inline-flex items-center gap-1 pl-2 border-l">
                  <Eye className="size-3" />
                  Cỡ chữ
                  <button onClick={() => setTextFontSize((s) => Math.max(12, s - 2))} className="px-1.5 hover:bg-muted rounded">A−</button>
                  <span className="tabular-nums">{textFontSize}</span>
                  <button onClick={() => setTextFontSize((s) => Math.min(48, s + 2))} className="px-1.5 hover:bg-muted rounded">A+</button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected-text mini toolbar */}
      {selectedTextIdx !== null && items[selectedTextIdx]?.kind === "text" && !presentationMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-card/95 backdrop-blur border rounded-full shadow px-2.5 py-1.5 flex items-center gap-2 text-sm">
          <Type className="size-4 text-primary" />
          <span className="text-muted-foreground text-xs">Textbox</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => changeFontSelected(-2)}>
            A−
          </Button>
          <span className="min-w-8 text-center tabular-nums text-xs">
            {(items[selectedTextIdx] as TextItem).fontSize}
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => changeFontSelected(2)}>
            A+
          </Button>
          <Button variant="destructive" size="sm" className="h-7 gap-1" onClick={deleteSelectedText}>
            <Trash2 className="size-3" /> Xóa
          </Button>
        </div>
      )}

      {/* Presentation mode top bar */}
      {presentationMode && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 bg-white/95 border rounded-full shadow px-3 py-1.5">
          <span className="font-heading text-sm font-semibold text-neutral-800">Trình chiếu</span>
          {currentIdx === -1 && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-600 pl-2 border-l">
              Cỡ chữ
              <button onClick={() => setTextFontSize((s) => Math.max(14, s - 4))} className="px-1.5 hover:bg-muted rounded">A−</button>
              <span className="tabular-nums">{textFontSize}</span>
              <button onClick={() => setTextFontSize((s) => Math.min(64, s + 4))} className="px-1.5 hover:bg-muted rounded">A+</button>
            </span>
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setPresentationMode(false)}>
            <X className="size-3.5" /> Thoát
          </Button>
        </div>
      )}

      {/* File thumb strip */}
      {(files.length > 0 || hasText) && !presentationMode && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-card/95 backdrop-blur border rounded-lg p-1 shadow-sm max-w-[70vw] overflow-x-auto no-scrollbar">
          {hasText && (
            <button
              type="button"
              onClick={() => setCurrentIdx(-1)}
              className={cn(
                "shrink-0 rounded px-2 h-10 text-xs flex items-center gap-1",
                currentIdx === -1 ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground",
              )}
            >
              <FileText className="size-3.5" />
              Văn bản
            </button>
          )}
          {files.map((f, i) => {
            const selected = currentIdx === i
            const Icon = fileIcon(f.kind)
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={cn(
                  "shrink-0 relative w-10 h-10 rounded overflow-hidden transition",
                  selected ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                )}
                title={f.name}
              >
                {f.kind === "image" ? (
                  <img
                    src={f.url || "/placeholder.svg"}
                    alt={f.name}
                    className="w-full h-full object-cover"
                    style={{ transform: `rotate(${rotations[i] ?? 0}deg)` }}
                  />
                ) : (
                  <div className="w-full h-full bg-muted/60 grid place-items-center text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                )}
                <span className="absolute top-0 left-0 bg-background/80 rounded-br px-1 text-[9px] font-mono">
                  {i + 1}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* File nav arrows */}
      {files.length > 1 && !presentationMode && (
        <>
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx <= 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-card/90 hover:bg-card border shadow rounded-full p-2 disabled:opacity-40"
            aria-label="Trước"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.min(files.length - 1, i + 1))}
            disabled={currentIdx >= files.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-card/90 hover:bg-card border shadow rounded-full p-2 disabled:opacity-40"
            aria-label="Sau"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* MAIN VIEWPORT */}
      <div
        ref={viewportRef}
        className={cn(
          "flex-1 overflow-auto",
          presentationMode ? "bg-white p-8" : "bg-muted/30 p-6 pt-20 pb-20",
        )}
      >
        <div
          className="mx-auto"
          style={{
            width: "fit-content",
            transform: `scale(${zoomLevel})`,
            transformOrigin: "top center",
            transition: panRef.current.active ? "none" : "transform 120ms ease-out",
          }}
        >
          <div
            ref={surfaceRef}
            className={cn(
              "relative bg-card rounded-md shadow-sm border",
              presentationMode && "bg-white shadow-none border-none",
              canAnnotate && tool !== "pan" ? "select-none touch-none" : "",
              "max-w-5xl",
            )}
            onPointerDown={canAnnotate || tool === "pan" ? onPointerDown : undefined}
            onPointerMove={(e) => {
              if (canAnnotate || tool === "pan") {
                onPointerMove(e)
                onTextPointerMove(e)
              }
            }}
            onPointerUp={() => {
              if (canAnnotate || tool === "pan") {
                onPointerUp()
                onTextPointerUp()
              }
            }}
            onPointerCancel={() => {
              if (canAnnotate || tool === "pan") {
                onPointerUp()
                onTextPointerUp()
              }
            }}
            style={{ cursor, minHeight: presentationMode ? undefined : "70vh" }}
          >
            {currentIdx === -1 ? (
              <div
                className={cn(
                  "whitespace-pre-wrap leading-relaxed",
                  presentationMode ? "p-10 text-neutral-900" : "p-6 text-foreground",
                )}
                style={{
                  fontSize: presentationMode ? `${Math.max(24, textFontSize * 1.5)}px` : `${textFontSize}px`,
                  lineHeight: 1.55,
                  minHeight: presentationMode ? undefined : "70vh",
                  minWidth: presentationMode ? "90vw" : "820px",
                }}
              >
                {textContent || (
                  <span className="text-muted-foreground">Nhóm này chưa nộp nội dung.</span>
                )}
              </div>
            ) : isImage && currentFile ? (
              <div className="relative p-2">
                <img
                  src={currentFile.url || "/placeholder.svg"}
                  alt={currentFile.name}
                  className="block max-w-[1200px] w-auto rounded-md pointer-events-none"
                  crossOrigin="anonymous"
                  style={{ transform: `rotate(${currentRotation}deg)`, maxHeight: "80vh" }}
                />
              </div>
            ) : isPdf && currentFile ? (
              <div className="w-[1000px] h-[78vh] relative">
                <iframe
                  src={currentFile.url}
                  title={currentFile.name}
                  className="w-full h-full rounded-md"
                />
                <div className="absolute top-2 right-2">
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <a href={currentFile.url} target="_blank" rel="noreferrer" download>
                      <Download className="size-3.5" />
                      Tải PDF
                    </a>
                  </Button>
                </div>
              </div>
            ) : isOffice && currentFile ? (
              <div className="w-[1000px] h-[78vh] relative">
                <iframe
                  src={officeEmbed(currentFile.url)}
                  title={currentFile.name}
                  className="w-full h-full rounded-md"
                  allow="fullscreen"
                />
                <div className="absolute top-2 right-2">
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <a href={currentFile.url} target="_blank" rel="noreferrer" download>
                      <Download className="size-3.5" />
                      Tải tệp
                    </a>
                  </Button>
                </div>
              </div>
            ) : currentFile ? (
              <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] gap-3 min-w-[600px]">
                <FileIcon className="size-16 text-muted-foreground" />
                <p className="font-medium">{currentFile.name}</p>
                <Button asChild variant="outline" className="gap-1">
                  <a href={currentFile.url} target="_blank" rel="noreferrer" download>
                    <Download className="size-4" />
                    Tải tệp về để xem
                  </a>
                </Button>
              </div>
            ) : (
              <div className="p-6 min-h-[70vh] min-w-[600px] grid place-items-center text-muted-foreground">
                Chưa có nội dung
              </div>
            )}

            {/* Annotations */}
            {canAnnotate && !presentationMode && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
              >
                {filteredItems.map(({ it, origIdx }) => {
                  if (it.kind === "path") {
                    const d = it.points
                      .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
                      .join(" ")
                    return (
                      <path
                        key={origIdx}
                        d={d}
                        stroke={it.color}
                        strokeWidth={it.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    )
                  }
                  if (it.kind === "highlight") {
                    return (
                      <rect
                        key={origIdx}
                        x={it.x}
                        y={it.y}
                        width={it.w}
                        height={it.h}
                        fill={it.color}
                        opacity={0.3}
                      />
                    )
                  }
                  if (it.kind === "underline") {
                    return (
                      <line
                        key={origIdx}
                        x1={it.x1}
                        y1={it.y1}
                        x2={it.x2}
                        y2={it.y2}
                        stroke={it.color}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    )
                  }
                  return null
                })}
              </svg>
            )}

            {/* Text items */}
            {canAnnotate && !presentationMode &&
              filteredItems.map(({ it, origIdx }) => {
                if (it.kind !== "text") return null
                const selected = selectedTextIdx === origIdx
                return (
                  <div
                    key={origIdx}
                    onPointerDown={(e) => beginTextDrag(e, origIdx, "move")}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTextIdx(origIdx)
                    }}
                    className={cn(
                      "absolute whitespace-pre leading-none cursor-move transition-shadow",
                      selected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-card rounded-sm"
                        : "hover:ring-1 hover:ring-primary/40 rounded-sm",
                    )}
                    style={{
                      left: it.x,
                      top: it.y - it.fontSize,
                      color: it.color,
                      fontSize: it.fontSize,
                      padding: "2px 4px",
                    }}
                  >
                    {it.text}
                    {selected && (
                      <button
                        type="button"
                        aria-label="Kéo để phóng to chữ"
                        onPointerDown={(e) => beginTextDrag(e, origIdx, "resize")}
                        className="absolute -right-2 -bottom-2 size-5 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md cursor-nwse-resize"
                      >
                        <MoveDiagonal className="size-3" />
                      </button>
                    )}
                  </div>
                )
              })}

            {/* Stamps */}
            {canAnnotate && !presentationMode &&
              filteredItems.map(({ it, origIdx }) => {
                if (it.kind !== "stamp") return null
                return (
                  <div
                    key={origIdx}
                    className="absolute font-heading font-bold pointer-events-none select-none drop-shadow-sm"
                    style={{
                      left: it.x,
                      top: it.y - it.fontSize,
                      color: it.color,
                      fontSize: it.fontSize,
                    }}
                  >
                    {it.label}
                  </div>
                )
              })}

            {pendingText && canAnnotate && (
              <div
                className="absolute z-10 flex items-start gap-1"
                style={{ left: pendingText.x, top: pendingText.y - 6 }}
              >
                <Input
                  autoFocus
                  value={pendingText.text}
                  onChange={(e) => setPendingText({ ...pendingText, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmText()
                    if (e.key === "Escape") setPendingText(null)
                  }}
                  className="h-8 w-48"
                  placeholder="Ghi chú..."
                  style={{ color }}
                />
                <Button size="icon" className="size-8" onClick={confirmText} aria-label="Xác nhận">
                  <Check className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hint góc phải phím tắt */}
      {!presentationMode && isFullscreen && (
        <div className="absolute bottom-3 right-3 z-20 bg-card/80 backdrop-blur text-xs text-muted-foreground px-2.5 py-1 rounded border">
          <kbd className="font-mono">F</kbd> toàn màn hình · <kbd className="font-mono">+/-</kbd> zoom · <kbd className="font-mono">P</kbd> trình chiếu · <kbd className="font-mono">Esc</kbd> thoát
        </div>
      )}
    </div>
  )
}

function ToolBtn({
  active,
  onClick,
  children,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "size-8 rounded-full grid place-items-center transition",
        active
          ? "bg-primary text-primary-foreground shadow"
          : disabled
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "hover:bg-muted text-foreground/80",
      )}
    >
      {children}
    </button>
  )
}
