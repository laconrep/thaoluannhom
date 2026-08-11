"use client"

import { useEffect, useState } from "react"

export function useCountdown(endsAt: string | null, status: string) {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!endsAt || status !== "running") return 0
    return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
  })

  useEffect(() => {
    if (!endsAt || status !== "running") {
      setRemaining(0)
      return
    }
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
      setRemaining(left)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endsAt, status])

  return remaining
}

export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}
