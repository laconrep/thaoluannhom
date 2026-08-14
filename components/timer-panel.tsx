"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, Pause, Play, RotateCcw, StopCircle } from "lucide-react"
import { useCountdown, formatClock } from "@/lib/use-countdown"
import {
  endSessionAction,
  pauseSessionAction,
  reopenSessionAction,
  startSessionAction,
} from "@/app/actions"

type Status = "idle" | "running" | "ended"

const PRESETS = [1, 3, 5, 10, 15, 20]

export function TimerPanel({
  sessionId,
  status,
  endsAt,
  durationSeconds,
  forceStart = false,
}: {
  sessionId: string
  status: Status
  endsAt: string | null
  durationSeconds: number
  forceStart?: boolean
}) {
  const [minutes, setMinutes] = useState<number>(() => Math.floor(durationSeconds / 60))
  const [seconds, setSeconds] = useState<number>(() => durationSeconds % 60)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenMin, setReopenMin] = useState(5)
  const [reopenSec, setReopenSec] = useState(0)
  const [, startTransition] = useTransition()
  const [forcedStartHandled, setForcedStartHandled] = useState(false)

  const left = useCountdown(endsAt, status)

  // Sync minutes/seconds when durationSeconds changes from props (e.g. when session reset)
  useEffect(() => {
    if (status !== "running") {
      setMinutes(Math.floor(durationSeconds / 60))
      setSeconds(durationSeconds % 60)
    }
  }, [durationSeconds, status])

  // Schedule auto-end exactly at ends_at timestamp (not driven by `left` which can lag)
  useEffect(() => {
    if (status !== "running" || !endsAt) return
    const ms = new Date(endsAt).getTime() - Date.now()
    if (ms <= 0) {
      startTransition(() => {
        endSessionAction(sessionId)
      })
      return
    }
    const id = setTimeout(() => {
      startTransition(() => {
        endSessionAction(sessionId)
      })
    }, ms + 300)
    return () => clearTimeout(id)
  }, [status, endsAt, sessionId])

  const totalConfigured = minutes * 60 + seconds
  const totalRemaining = left
  const totalInitial =
    status === "running" && endsAt
      ? Math.max(totalConfigured, totalRemaining, 1)
      : totalConfigured || 1
  const progressPct =
    status === "running"
      ? Math.max(0, Math.min(100, (totalRemaining / totalInitial) * 100))
      : status === "ended"
        ? 0
        : 100

  const clockValue = status === "running" ? formatClock(left) : formatClock(totalConfigured)

  const isLow = status === "running" && left > 0 && left <= 15

  function handleStart() {
    const dur = Math.max(5, minutes * 60 + seconds)
    startTransition(() => {
      startSessionAction(sessionId, dur)
    })
  }
  useEffect(() => {
    if (forceStart && status === "idle" && !forcedStartHandled) {
      setForcedStartHandled(true)
      const duration = Math.max(5, minutes * 60 + seconds)
      startTransition(() => { startSessionAction(sessionId, duration) })
    }
  }, [forceStart, forcedStartHandled, status, minutes, seconds, sessionId])

  function handlePause() {
    startTransition(() => {
      pauseSessionAction(sessionId)
    })
  }
  function handleEnd() {
    if (!confirm("Kết thúc phiên? Học sinh sẽ không nộp được nữa.")) return
    startTransition(() => {
      endSessionAction(sessionId)
    })
  }
  function handleReopen() {
    const extra = Math.max(5, reopenMin * 60 + reopenSec)
    startTransition(() => {
      reopenSessionAction(sessionId, extra)
    })
    setReopenOpen(false)
  }
  function applyPreset(mins: number) {
    setMinutes(mins)
    setSeconds(0)
  }

  return (
    <div className="rounded-md border bg-card p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Clock
          className={`size-4 ${isLow ? "text-destructive animate-pulse" : "text-primary"}`}
          aria-hidden="true"
        />
        <div
          className={`flex-1 text-center font-mono text-xl tabular-nums font-semibold ${
            isLow ? "text-destructive" : ""
          }`}
        >
          {clockValue}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isLow ? "bg-destructive" : status === "ended" ? "bg-muted-foreground/30" : "bg-primary"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {status !== "running" && !reopenOpen && (
        <>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={180}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(180, Number(e.target.value) || 0)))}
              className="h-8 text-xs text-center"
              aria-label="Phút"
            />
            <span className="text-xs text-muted-foreground">phút</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
              className="h-8 text-xs text-center"
              aria-label="Giây"
            />
            <span className="text-xs text-muted-foreground">giây</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => applyPreset(m)}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  minutes === m && seconds === 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 hover:bg-muted"
                }`}
              >
                {m}p
              </button>
            ))}
          </div>
        </>
      )}

      {status === "idle" && (
        <Button size="sm" onClick={handleStart} className="gap-1">
          <Play className="size-4" aria-hidden="true" />
          Bắt đầu
        </Button>
      )}

      {status === "running" && (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={handlePause} className="flex-1 gap-1">
            <Pause className="size-3" aria-hidden="true" />
            Dừng
          </Button>
          <Button size="sm" variant="destructive" onClick={handleEnd} className="flex-1 gap-1">
            <StopCircle className="size-3" aria-hidden="true" />
            Kết thúc
          </Button>
        </div>
      )}

      {status === "ended" && !reopenOpen && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-center text-muted-foreground">Đã kết thúc</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReopenOpen(true)}
            className="gap-1"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Mở lại phiên
          </Button>
        </div>
      )}

      {status === "ended" && reopenOpen && (
        <div className="flex flex-col gap-1.5 rounded border border-dashed p-2 bg-muted/30">
          <p className="text-[11px] font-medium">Mở thêm bao lâu?</p>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={180}
              value={reopenMin}
              onChange={(e) =>
                setReopenMin(Math.max(0, Math.min(180, Number(e.target.value) || 0)))
              }
              className="h-7 text-xs text-center"
              aria-label="Phút"
            />
            <span className="text-[10px] text-muted-foreground">p</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={reopenSec}
              onChange={(e) =>
                setReopenSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
              }
              className="h-7 text-xs text-center"
              aria-label="Giây"
            />
            <span className="text-[10px] text-muted-foreground">g</span>
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleReopen} className="flex-1 h-7 text-xs">
              Mở lại
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReopenOpen(false)}
              className="h-7 text-xs"
            >
              Hủy
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
