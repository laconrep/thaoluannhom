"use client"

import { useMemo, useState } from "react"
import type {
  SessionRow,
  SessionGroupRow,
  SubmissionRow,
  AnnotationRow,
  SubmissionFile,
  AnnotationItem,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Users, Download, FileText, Presentation, File as FileIcon } from "lucide-react"

function getFiles(sub?: SubmissionRow): SubmissionFile[] {
  if (!sub) return []
  const files = (sub.files ?? []) as SubmissionFile[]
  if (files.length > 0) return files
  if (sub.image_url) {
    return [{ url: sub.image_url, name: "bai-nop", kind: "image", mime: "image/*", rotation: 0 }]
  }
  return []
}

function officeUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

export function ResultsViewer({
  className,
  session,
  groups,
  submissions,
  annotations,
}: {
  className: string
  session: SessionRow
  groups: SessionGroupRow[]
  submissions: SubmissionRow[]
  annotations: AnnotationRow[]
}) {
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null)
  const [activeFileIdx, setActiveFileIdx] = useState(0)

  const subsByGroup = useMemo(() => {
    const m: Record<string, SubmissionRow> = {}
    for (const s of submissions) if (s.session_group_id) m[s.session_group_id] = s
    return m
  }, [submissions])

  const annsByGroup = useMemo(() => {
    const m: Record<string, AnnotationRow> = {}
    for (const a of annotations) if (a.session_group_id) m[a.session_group_id] = a
    return m
  }, [annotations])

  const active = groups.find((g) => g.id === activeId) ?? null
  const sub = active ? subsByGroup[active.id] : undefined
  const ann = active ? annsByGroup[active.id] : undefined
  const files = getFiles(sub)
  const file = files[activeFileIdx]

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Users className="size-5 text-primary" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{className}</p>
            <h1 className="font-semibold truncate">{session.title}</h1>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Kết quả thảo luận
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid md:grid-cols-[220px_1fr] gap-4">
        <aside className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {groups.length} nhóm
          </p>
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {groups.map((g) => {
              const gSub = subsByGroup[g.id]
              const hasContent = !!gSub
              const score = annsByGroup[g.id]?.score
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setActiveId(g.id)
                    setActiveFileIdx(0)
                  }}
                  className={`shrink-0 md:shrink text-left p-3 rounded-lg border transition ${
                    activeId === g.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{g.label}</span>
                    {score !== null && score !== undefined && (
                      <span className="text-xs font-bold tabular-nums">{score}</span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {hasContent ? "Đã nộp" : "Không có bài"}
                  </p>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-3">
          {active ? (
            <>
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold">{active.label}</h2>
                    {ann?.score !== null && ann?.score !== undefined && (
                      <p className="text-sm mt-1">
                        Điểm: <span className="font-bold text-primary">{ann.score}</span>
                      </p>
                    )}

                  </div>
                  {session.allow_download && file?.url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={file.url} download={file.name}>
                        <Download className="size-4 mr-2" aria-hidden="true" />
                        Tải xuống
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {sub?.text_content && (
                <div className="bg-card rounded-lg border p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Phần viết
                  </p>
                  <p className="whitespace-pre-wrap text-lg leading-relaxed">
                    {sub.text_content}
                  </p>
                </div>
              )}

              {files.length > 0 && (
                <div className="bg-card rounded-lg border overflow-hidden">
                  {files.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto p-2 border-b bg-muted/30">
                      {files.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveFileIdx(i)}
                          className={`shrink-0 size-14 rounded border-2 overflow-hidden flex items-center justify-center ${
                            i === activeFileIdx ? "border-primary" : "border-transparent"
                          }`}
                        >
                          {f.kind === "image" ? (
                            <img
                              src={f.url || "/placeholder.svg"}
                              alt=""
                              className="size-full object-cover"
                              style={{ transform: `rotate(${f.rotation ?? 0}deg)` }}
                            />
                          ) : f.kind === "pptx" ? (
                            <Presentation className="size-5 text-muted-foreground" />
                          ) : f.kind === "docx" ? (
                            <FileText className="size-5 text-muted-foreground" />
                          ) : (
                            <FileIcon className="size-5 text-muted-foreground" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="relative bg-muted/20 flex items-center justify-center min-h-[60vh]">
                    {file?.kind === "image" ? (
                      <div className="relative">
                        <img
                          src={file.url || "/placeholder.svg"}
                          alt=""
                          className="max-w-full max-h-[75vh] object-contain"
                          style={{ transform: `rotate(${file.rotation ?? 0}deg)` }}
                        />
                        {ann?.data && <AnnotationOverlay items={ann.data as AnnotationItem[]} fileIdx={activeFileIdx} />}
                      </div>
                    ) : file?.kind === "pdf" ? (
                      <iframe src={file.url} className="w-full h-[80vh]" title={file.name} />
                    ) : file?.kind === "docx" || file?.kind === "pptx" ? (
                      <iframe src={officeUrl(file.url)} className="w-full h-[80vh]" title={file.name} />
                    ) : (
                      <p className="p-8 text-muted-foreground">Không có file để xem</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-card rounded-lg border p-12 text-center">
              <p className="text-muted-foreground">Chọn một nhóm bên trái để xem kết quả</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function AnnotationOverlay({ items, fileIdx }: { items: AnnotationItem[]; fileIdx: number }) {
  const relevant = items.filter((it) => {
    if (it.kind === "text" || it.kind === "highlight" || it.kind === "underline" || it.kind === "stamp") {
      return (it.fileIndex ?? 0) === fileIdx
    }
    return true
  })
  return (
    <div className="pointer-events-none absolute inset-0">
      {relevant.map((it, i) => {
        if (it.kind === "text") {
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${it.x * 100}%`,
                top: `${it.y * 100}%`,
                color: it.color,
                fontSize: it.fontSize,
              }}
            >
              {it.text}
            </div>
          )
        }
        if (it.kind === "stamp") {
          return (
            <div
              key={i}
              className="absolute font-bold"
              style={{
                left: `${it.x * 100}%`,
                top: `${it.y * 100}%`,
                color: it.color,
                fontSize: it.fontSize,
              }}
            >
              {it.label}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
