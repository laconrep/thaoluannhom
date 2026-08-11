"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  X,
} from "lucide-react"
import { playNotificationSound } from "@/lib/presentation-utils"

export interface PresentationViewerProps {
  presentationId: string
  sessionId: string
  isTeacher: boolean
  children: React.ReactNode
  groupCount: number
  submissions: any[]
}

export function PresentationViewer({
  presentationId,
  sessionId,
  isTeacher,
  children,
  groupCount,
  submissions,
}: PresentationViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [slideCount, setSlideCount] = useState(0)
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(`pres-hidden-${presentationId}`) === "true"
  })
  const [slides, setSlides] = useState<string[]>([])
  const [groupStatuses, setGroupStatuses] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  // Load presentation details
  useEffect(() => {
    const loadPresentation = async () => {
      try {
        const { data, error } = await supabase
          .from("presentations")
          .select("slide_count, current_slide")
          .eq("id", presentationId)
          .single()

        if (error || !data) {
          return
        }

        setSlideCount(data.slide_count)
        setCurrentSlide(data.current_slide || 0)

        // Load slide paths
        const { data: slideData, error: slideError } = await supabase
          .from("presentation_slides")
          .select("slide_number, image_path")
          .eq("presentation_id", presentationId)
          .order("slide_number")

        if (!slideError && slideData) {
          const sortedSlides = slideData.sort((a: any, b: any) => a.slide_number - b.slide_number)
          const slidePaths: string[] = []

          for (const slide of sortedSlides) {
            const { data: signedUrl } = await supabase.storage
              .from("presentations")
              .createSignedUrl(slide.image_path, 3600)
            if (signedUrl) {
              slidePaths.push(signedUrl.signedUrl)
            }
          }

          setSlides(slidePaths)
        }
      } catch (err) {
        // Silently fail if tables don't exist yet
      }
    }

    loadPresentation()
  }, [presentationId, supabase])

  // Listen for slide changes
  useEffect(() => {
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
          if (payload.new) {
            setCurrentSlide(payload.new.current_slide || 0)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [presentationId, supabase])

  // Track group submission statuses
  useEffect(() => {
    const statuses: Record<string, boolean> = {}
    for (let i = 0; i < groupCount; i++) {
      const groupId = `group-${i}`
      const hasSubmission = submissions.some((s) => s.session_group_id === groupId && s.id)
      statuses[groupId] = hasSubmission
    }
    setGroupStatuses(statuses)
  }, [submissions, groupCount])

  // Play sound and notify when new group submits
  useEffect(() => {
    const statusString = JSON.stringify(groupStatuses)
    const lastStatusString = localStorage.getItem(`group-statuses-${sessionId}`)
    
    if (lastStatusString && lastStatusString !== statusString) {
      const lastStatuses = JSON.parse(lastStatusString)
      for (const [groupId, submitted] of Object.entries(groupStatuses)) {
        if (submitted && !lastStatuses[groupId]) {
          playNotificationSound()
          break
        }
      }
    }
    
    localStorage.setItem(`group-statuses-${sessionId}`, statusString)
  }, [groupStatuses, sessionId])

  const handlePrevSlide = useCallback(async () => {
    if (currentSlide > 0) {
      const newSlide = currentSlide - 1
      setCurrentSlide(newSlide)
      if (isTeacher) {
        await fetch(`/api/presentations/${presentationId}/slide`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideNumber: newSlide + 1 }),
        })
      }
    }
  }, [currentSlide, isTeacher, presentationId])

  const handleNextSlide = useCallback(async () => {
    if (currentSlide < slideCount - 1) {
      const newSlide = currentSlide + 1
      setCurrentSlide(newSlide)
      if (isTeacher) {
        await fetch(`/api/presentations/${presentationId}/slide`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideNumber: newSlide + 1 }),
        })
      }
    }
  }, [currentSlide, slideCount, isTeacher, presentationId])

  const handleToggleHidden = () => {
    const newState = !isHidden
    setIsHidden(newState)
    localStorage.setItem(`pres-hidden-${presentationId}`, String(newState))
  }

  if (slideCount === 0) {
    return <>{children}</>
  }

  const currentSlideUrl = slides[currentSlide]

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Main slide display */}
      <div className={`transition-all duration-300 ${isHidden ? "ml-[4%]" : "w-full"}`}>
        {currentSlideUrl && (
          <img
            src={currentSlideUrl}
            alt={`Slide ${currentSlide + 1}`}
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Teacher controls (always visible for teacher) */}
      {isTeacher && !isHidden && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-40 bg-black/50 rounded-lg px-6 py-3">
          <Button
            onClick={handlePrevSlide}
            disabled={currentSlide === 0}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
          >
            <ChevronLeft className="size-5" />
          </Button>

          <div className="flex items-center gap-2 text-white">
            <span className="text-sm font-medium">
              {currentSlide + 1} / {slideCount}
            </span>
          </div>

          <Button
            onClick={handleNextSlide}
            disabled={currentSlide === slideCount - 1}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
          >
            <ChevronRight className="size-5" />
          </Button>

          <Button
            onClick={handleToggleHidden}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 ml-4"
          >
            {isHidden ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </Button>
        </div>
      )}

      {/* Thin bar on left when hidden */}
      {isHidden && (
        <div className="absolute left-0 top-0 h-full w-[4%] bg-black/80 border-r border-white/20 flex flex-col z-40">
          <div className="flex-1 flex flex-col gap-1 p-1 justify-center">
            {/* Top 4 groups */}
            {Array.from({ length: Math.min(4, groupCount) }).map((_, i) => {
              const groupId = `group-${i}`
              const submitted = groupStatuses[groupId]
              return (
                <div
                  key={groupId}
                  className={`flex-1 rounded transition-colors ${
                    submitted ? "bg-green-500" : "bg-red-500"
                  }`}
                  title={`Nhóm ${i + 1} - ${submitted ? "Đã nộp" : "Chưa nộp"}`}
                />
              )
            })}
          </div>

          <div className="h-px bg-white/20" />

          <div className="flex-1 flex flex-col gap-1 p-1 justify-center">
            {/* Bottom 4 groups */}
            {Array.from({ length: Math.min(4, groupCount - 4) }).map((_, i) => {
              const groupId = `group-${i + 4}`
              const submitted = groupStatuses[groupId]
              return (
                <div
                  key={groupId}
                  className={`flex-1 rounded transition-colors ${
                    submitted ? "bg-green-500" : "bg-red-500"
                  }`}
                  title={`Nhóm ${i + 5} - ${submitted ? "Đã nộp" : "Chưa nộp"}`}
                />
              )
            })}
          </div>

          {/* Close button */}
          <Button
            onClick={handleToggleHidden}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 m-1"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {/* Group discussion board overlay (hidden when presentation is shown) */}
      {!isHidden && (
        <div className="absolute left-0 top-0 h-full w-full z-30 pointer-events-none">
          {children}
        </div>
      )}

      {/* When hidden, board is still accessible but in background */}
      {isHidden && (
        <div className="absolute left-[4%] top-0 h-full w-[calc(100%-4%)] pointer-events-none opacity-0">
          {children}
        </div>
      )}
    </div>
  )
}
