"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { saveAnnotationAction, togglePasteAction, unlockSlotAction } from "@/app/actions"
import type {
  AnnotationItem,
  AnnotationRow,
  SessionRow,
  SessionSlotRow,
  SubmissionFile,
  SubmissionRow,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { AnnotationEditor } from "@/components/annotation-editor"
import { TimerPanel } from "@/components/timer-panel"
import { Switch } from "@/components/ui/switch"
import { AvatarInitials } from "@/components/avatar-initials"
import { toast } from "sonner"
import {
  ArrowLeft,
  Link as LinkIcon,
  ClipboardList,
  Unlock,
  Presentation,
  FileText,
  File as FileIcon,
  Check,
} from "lucide-react"

function getFilesI(sub: SubmissionRow | undefined): SubmissionFile[] {
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

export function IndividualBoard({
  classId,
  className,
  shareToken,
  session: initialSession,
  slots: initialSlots,
  students,
  submissions: initialSubs,
  annotations: initialAnns,
}: {
  classId: string
  className: string
  shareToken: string
  session: SessionRow
  slots: SessionSlotRow[]
  students: { id: string; slot_number: number; name: string | null }[]
  submissions: SubmissionRow[]
  annotations: AnnotationRow[]
}) {
  const [session, setSession] = useState(initialSession)
  const [slots, setSlots] = useState(initialSlots)
  const [subs, setSubs] = useState(initialSubs)
  const [anns, setAnns] = useState(initialAnns)
  const [openSlotId, setOpenSlotId] = useState<string | null>(null)

  const studentMap = useMemo(() => {
    const m: Record<string, { id: string; slot_number: number; name: string | null }> = {}
    for (const s of students) m[s.id] = s
    return m
  }, [students])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`isess-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (p: { new?: SessionRow }) => p.new && setSession(p.new as SessionRow),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `session_id=eq.${session.id}` },
        (p: { eventType: string; new?: SubmissionRow }) => {
          if ((p.eventType === "INSERT" || p.eventType === "UPDATE") && p.new) {
            setSubs((cur) => {
              const idx = cur.findIndex((x) => x.id === p.new!.id)
              if (idx >= 0) {
                const n = cur.slice()
                n[idx] = p.new!
                return n
              }
              return [...cur, p.new!]
            })
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "annotations", filter: `session_id=eq.${session.id}` },
        (p: { eventType: string; new?: AnnotationRow }) => {
          if ((p.eventType === "INSERT" || p.eventType === "UPDATE") && p.new) {
            setAnns((cur) => {
              const idx = cur.findIndex((x) => x.id === p.new!.id)
              if (idx >= 0) {
                const n = cur.slice()
                n[idx] = p.new!
                return n
              }
              return [...cur, p.new!]
            })
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_slots", filter: `session_id=eq.${session.id}` },
        (p: { eventType: string; new?: SessionSlotRow }) => {
          if (p.eventType === "UPDATE" && p.new) {
            setSlots((cur) => cur.map((x) => (x.id === p.new!.id ? p.new! : x)))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [session.id])

  const subsBySlot = useMemo(() => {
    const m: Record<string, SubmissionRow> = {}
    for (const s of subs) if (s.session_slot_id) m[s.session_slot_id] = s
    return m
  }, [subs])

  const annsBySlot = useMemo(() => {
    const m: Record<string, AnnotationRow> = {}
    for (const a of anns) if (a.session_slot_id) m[a.session_slot_id] = a
    return m
  }, [anns])

  const openSlot = openSlotId ? slots.find((s) => s.id === openSlotId) : null
  const openStudent = openSlot?.student_id ? studentMap[openSlot.student_id] : null
  const openSub = openSlot ? subsBySlot[openSlot.id] : null
  const openAnn = openSlot ? annsBySlot[openSlot.id] : null

  function copyShareLink() {
    const url = `${window.location.origin}/c/${shareToken}/session/${session.id}`
    navigator.clipboard.writeText(url)
    toast.success("Đã sao chép liên kết cho học sinh")
  }

  const submittedCount = Object.keys(subsBySlot).length

  return (
    <div className="-mx-4 -my-6">
      <div className="grid grid-cols-12 gap-3 h-[calc(100svh-170px)] px-4">
        <aside className="col-span-12 md:col-span-2 flex md:flex-col gap-2 border rounded-xl bg-card p-3 overflow-auto">
          <Link
            href={`/classes/${classId}/individual`}
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="size-3" aria-hidden="true" />
            Tất cả giao việc
          </Link>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-sm leading-tight line-clamp-2">
              {session.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{className}</p>
          </div>

          <TimerPanel
            sessionId={session.id}
            status={session.status}
            endsAt={session.ends_at}
            durationSeconds={session.duration_seconds}
          />

          <Button variant="outline" size="sm" onClick={copyShareLink} className="gap-1">
            <LinkIcon className="size-3" aria-hidden="true" />
            Lấy link
          </Button>

          <label className="flex items-center justify-between gap-2 text-xs rounded-md border px-2 py-1.5 bg-muted/30 mt-1">
            <span className="leading-tight">Cho phép dán</span>
            <Switch
              checked={session.allow_paste}
              onCheckedChange={(v) => togglePasteAction(session.id, v)}
              aria-label="Cho phép dán"
            />
          </label>

          <div className="rounded-md border bg-primary/5 p-2 flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" />
            <div className="text-xs">
              <p className="font-semibold tabular-nums">
                {submittedCount} / {slots.length}
              </p>
              <p className="text-muted-foreground">Đã nộp</p>
            </div>
          </div>
        </aside>

        <div className="col-span-12 md:col-span-10 overflow-auto">
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {slots.map((slot) => {
              const st = slot.student_id ? studentMap[slot.student_id] : null
              const sub = subsBySlot[slot.id]
              const ann = annsBySlot[slot.id]
              const files = getFilesI(sub)
              const firstImage = files.find((f) => f.kind === "image")
              const firstFile = files[0]
              const hasStudent = !!slot.student_id
              return (
                <div
                  key={slot.id}
                  className="aspect-square rounded-lg border bg-card p-1.5 flex flex-col gap-1 hover:ring-2 hover:ring-primary/40 hover:-translate-y-0.5 transition relative overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setOpenSlotId(slot.id)}
                    className="absolute inset-0 z-0"
                    aria-label={`Mở ô ${slot.slot_number}`}
                  />
                  <div className="relative z-10 flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                      #{slot.slot_number}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {sub && <Check className="size-3 text-primary" aria-hidden="true" />}
                      {ann?.score !== null && ann?.score !== undefined && (
                        <span className="text-[10px] font-bold text-primary tabular-nums">
                          {ann.score}
                        </span>
                      )}
                      {hasStudent && (
                        <button
                          type="button"
                          title="Mở lại ô — xóa bài đã nộp"
                          onClick={(e) => {
                            e.stopPropagation()
                            const who = st?.name?.trim() || `Ô ${slot.slot_number}`
                            if (!confirm(`Mở lại ${who}? Bài đã nộp và phần chấm sẽ bị xóa.`)) return
                            unlockSlotAction(slot.id, true)
                            toast.success(`Đã mở lại ${who}`)
                          }}
                          className="text-muted-foreground hover:text-destructive p-0.5 rounded hover:bg-muted relative z-20"
                        >
                          <Unlock className="size-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-1 pointer-events-none">
                    {st && <AvatarInitials name={st.name ?? ""} size="xs" />}
                    <p className="text-xs font-medium leading-tight line-clamp-1 flex-1 min-w-0">
                      {st?.name?.trim() || <span className="text-muted-foreground">—</span>}
                    </p>
                  </div>

                  <div className="relative z-0 flex-1 rounded bg-muted/30 overflow-hidden pointer-events-none">
                    {firstImage ? (
                      <img
                        src={firstImage.url || "/placeholder.svg"}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ transform: `rotate(${firstImage.rotation ?? 0}deg)` }}
                      />
                    ) : firstFile ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
                        {firstFile.kind === "pptx" ? (
                          <Presentation className="size-4" aria-hidden="true" />
                        ) : firstFile.kind === "docx" ? (
                          <FileText className="size-4" aria-hidden="true" />
                        ) : (
                          <FileIcon className="size-4" aria-hidden="true" />
                        )}
                        <span className="text-[9px] line-clamp-1 px-1 text-center">
                          {firstFile.kind.toUpperCase()}
                        </span>
                      </div>
                    ) : sub?.text_content ? (
                      <p className="absolute inset-0 p-1 text-[9px] overflow-hidden leading-tight">
                        {sub.text_content.slice(0, 80)}
                      </p>
                    ) : null}
                    {files.length > 1 && (
                      <span className="absolute bottom-0.5 right-0.5 bg-card/90 backdrop-blur rounded px-1 py-[1px] border text-[9px] font-semibold">
                        +{files.length - 1}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {openSlot && (
        <AnnotationEditor
          title={`${openStudent?.name || `Ô ${openSlot.slot_number}`} — ${session.title}`}
          files={getFilesI(openSub ?? undefined)}
          textContent={openSub?.text_content ?? null}
          initialData={(openAnn?.data ?? []) as AnnotationItem[]}
          initialScore={openAnn?.score ?? null}
          autoFullscreen
          onSave={async (data, score) => {
            await saveAnnotationAction({
              sessionId: session.id,
              sessionSlotId: openSlot.id,
              data,
              score,
            })
            toast.success("Đã lưu chấm bài")
          }}
          onClose={() => setOpenSlotId(null)}
        />
      )}
    </div>
  )
}
