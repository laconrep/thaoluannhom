"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronRight, PanelLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface PresentationViewerProps {
  presentationId: string
  sessionId: string
  isTeacher: boolean
  children: React.ReactNode
  groupCount: number
  submissions: any[]
  groups?: any[]
}

export function PresentationViewer({ presentationId, sessionId, isTeacher, children, groupCount, submissions, groups = [] }: PresentationViewerProps) {
  const [presentation, setPresentation] = useState<any>(null)
  const [active, setActive] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [hoverTimer, setHoverTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("presentations").select("*").eq("id", presentationId).single()
      if (!data) return
      setPresentation(data)
      if (!isTeacher) setActive(Boolean(data.is_visible))
      const { data: signed } = await supabase.storage.from("presentations").createSignedUrl(data.storage_path ?? data.file_path, 3600)
      if (signed?.signedUrl) setSourceUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signed.signedUrl)}`)
    }
    load()
  }, [presentationId, supabase])

  useEffect(() => {
    const start = () => setActive(true)
    const openGroup = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      window.dispatchEvent(new CustomEvent("presentation-open-group", { detail: id }))
      setDrawerOpen(false)
    }
    window.addEventListener("presentation-start", start)
    window.addEventListener("presentation-open-group", openGroup)
    return () => {
      window.removeEventListener("presentation-start", start)
      window.removeEventListener("presentation-open-group", openGroup)
    }
  }, [])

  useEffect(() => {
    if (!active || !presentation) return
    const channel = supabase.channel(`presentation-${presentationId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "presentations", filter: `id=eq.${presentationId}` }, (payload: any) => {
        setPresentation(payload.new)
        if (!isTeacher) setActive(Boolean(payload.new?.is_visible))
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [active, presentation, presentationId, supabase])

  const orderedGroups = Array.from({ length: Math.max(groupCount, 8) }, (_, i) => i + 1)
  const hasSubmission = (number: number) => {
    const group = groups.find((item) => item.group_number === number)
    return group ? submissions.some((item) => item.session_group_id === group.id) : false
  }
  const startPresentation = () => {
    setActive(true)
    supabase.from("presentations").update({ is_visible: true }).eq("id", presentationId).then(() => undefined)
  }
  const stopPresentation = () => {
    setActive(false)
    setDrawerOpen(false)
    supabase.from("presentations").update({ is_visible: false }).eq("id", presentationId).then(() => undefined)
  }
  const openGroup = (number: number) => {
    const sessionGroup = groups.find((item) => item.group_number === number)
    if (sessionGroup) window.dispatchEvent(new CustomEvent("presentation-open-group", { detail: sessionGroup.id }))
  }

  if (!presentation) return <>{children}</>
  if (!active) return <div className="relative min-h-full">{children}{isTeacher && <Button onClick={startPresentation} className="fixed bottom-5 right-5 z-40 gap-2"><PanelLeft className="size-4" />Trình chiếu PowerPoint</Button>}</div>

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white">
      {sourceUrl ? <iframe title={presentation.file_name} src={sourceUrl} className="absolute inset-0 h-full w-full border-0" allowFullScreen /> : <div className="grid h-full place-items-center">Đang mở PowerPoint…</div>}
      {isTeacher && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-3" onMouseEnter={() => setHoverTimer(setTimeout(() => setDrawerOpen(true), 2000))} onMouseLeave={() => { if (hoverTimer) clearTimeout(hoverTimer) }} />
          <div className={`absolute left-0 top-0 bottom-0 w-[min(340px,82vw)] bg-background text-foreground shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex items-center justify-between border-b p-3"><strong>Giao việc cho nhóm</strong><button onClick={() => setDrawerOpen(false)} aria-label="Thu gọn bảng nhóm" className="rounded p-1 hover:bg-muted"><ChevronRight className="size-5" /></button></div>
            <div className="grid grid-cols-2 gap-2 p-3">{orderedGroups.map((number) => <button key={number} onClick={() => openGroup(number)} className="rounded border p-3 text-left hover:border-primary"><span className="font-semibold">Nhóm {number}</span><span className="block text-xs text-muted-foreground">{hasSubmission(number) ? "Đã nộp bài" : "Chưa nộp bài"}</span></button>)}</div>
          </div>
          <div className="absolute inset-y-0 left-0 flex w-[3.333vw] flex-col justify-center gap-1 py-8">{orderedGroups.slice(0, 4).map((number) => hasSubmission(number) && <button key={number} onClick={() => openGroup(number)} className="h-[5vh] w-full rounded-r bg-primary text-primary-foreground text-[10px]">{number}</button>)}</div>
          <div className="absolute inset-y-0 right-0 flex w-[3.333vw] flex-col justify-center gap-1 py-8">{orderedGroups.slice(4, 8).map((number) => hasSubmission(number) && <button key={number} onClick={() => openGroup(number)} className="h-[5vh] w-full rounded-l bg-primary text-primary-foreground text-[10px]">{number}</button>)}</div>
          <button onClick={stopPresentation} aria-label="Đóng trình chiếu" className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><X className="size-4" /></button>
        </>
      )}
    </div>
  )
}

export function startPresentationMode() { window.dispatchEvent(new Event("presentation-start")) }
