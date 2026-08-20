"use client"

import { useState } from "react"
import type { AnnotationRow, SessionGroupRow, SubmissionFile, SubmissionRow } from "@/lib/types"
import { Card } from "@/components/ui/card"
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Presentation,
  Unlock,
} from "lucide-react"
import { getFiles } from "@/lib/submission-files"

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

export function GroupCardsGrid({
  groups,
  subsByGroup,
  annsByGroup,
  liveMap,
  colsClass,
  onOpen,
  onUnlock,
  onMaximize,
  compact = false,
}: {
  groups: SessionGroupRow[]
  subsByGroup: Record<string, SubmissionRow>
  annsByGroup: Record<string, AnnotationRow>
  liveMap: Record<string, number>
  colsClass?: string
  onOpen: (groupId: string) => void
  onUnlock?: (group: SessionGroupRow) => void
  onMaximize?: (index: number) => void
  compact?: boolean
}) {
  const [confirmGroupId, setConfirmGroupId] = useState<string | null>(null)

  return (
    <div
      className={`grid ${colsClass ?? "grid-cols-3"} gap-2.5 ${
        compact ? "auto-rows-[170px]" : "auto-rows-fr h-full"
      }`}
    >
      {groups.map((g, idx) => {
        const sub = subsByGroup[g.id]
        const ann = annsByGroup[g.id]
        const files = getFiles(sub)
        const hasContent = files.length > 0 || !!sub?.text_content
        const isLive = !!liveMap[g.id]
        const confirming = confirmGroupId === g.id
        return (
          <Card
            key={g.id}
            className="group overflow-hidden hover:ring-2 hover:ring-primary/40 transition cursor-pointer flex flex-col float-card"
            onClick={() => {
              setConfirmGroupId(null)
              onOpen(g.id)
            }}
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
                {g.claimed && onUnlock && confirming ? (
                  <>
                    <button
                      type="button"
                      title="Mở lại nhóm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmGroupId(null)
                        onUnlock(g)
                      }}
                      className="rounded bg-destructive text-white px-1.5 py-0.5 text-[10px] font-semibold hover:bg-destructive/90"
                    >
                      Mở lại
                    </button>
                    <button
                      type="button"
                      title="Hủy"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmGroupId(null)
                      }}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/70"
                    >
                      Hủy
                    </button>
                  </>
                ) : (
                  g.claimed &&
                  onUnlock && (
                    <button
                      type="button"
                      title="Mở lại nhóm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmGroupId(g.id)
                      }}
                      className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted"
                    >
                      <Unlock className="size-3.5" aria-hidden="true" />
                    </button>
                  )
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
              {onMaximize && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMaximize(idx)
                  }}
                  className="absolute top-1.5 right-1.5 bg-card/90 backdrop-blur rounded-md p-1 border text-muted-foreground hover:text-primary shadow-sm opacity-0 group-hover:opacity-100 transition"
                  title="Phóng to nhóm này để cả lớp xem"
                >
                  <Maximize2 className="size-3" />
                </button>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
