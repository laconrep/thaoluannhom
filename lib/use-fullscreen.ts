"use client"

import { useEffect, useState, useCallback, RefObject } from "react"

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handler = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      setIsFullscreen(!!fsElement && fsElement === ref.current)
    }
    document.addEventListener("fullscreenchange", handler)
    document.addEventListener("webkitfullscreenchange", handler)
    document.addEventListener("mozfullscreenchange", handler)
    return () => {
      document.removeEventListener("fullscreenchange", handler)
      document.removeEventListener("webkitfullscreenchange", handler)
      document.removeEventListener("mozfullscreenchange", handler)
    }
  }, [ref])

  const enter = useCallback(async () => {
    const el = ref.current as any
    if (!el) return
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      else if (el.mozRequestFullScreen) await el.mozRequestFullScreen()
    } catch (e) {
      console.warn("Không vào được chế độ toàn màn hình:", e)
    }
  }, [ref])

  const exit = useCallback(async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen()
      else if ((document as any).mozCancelFullScreen) await (document as any).mozCancelFullScreen()
    } catch {}
  }, [])

  const toggle = useCallback(() => {
    if (isFullscreen) exit()
    else enter()
  }, [isFullscreen, enter, exit])

  return { isFullscreen, enter, exit, toggle }
}
