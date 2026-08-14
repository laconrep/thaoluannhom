"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TriangleAlert } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled error:", error)
  }, [error])

  return (
    <div className="min-h-svh bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-dashed bg-muted/30 px-6 py-12 flex flex-col items-center text-center gap-3">
        <div className="size-14 rounded-full bg-destructive/10 text-destructive grid place-items-center">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </div>
        <h1 className="font-heading font-semibold text-lg text-pretty">
          Có lỗi xảy ra khi tải trang
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Vui lòng thử lại. Nếu lỗi vẫn tiếp diễn, hãy tải lại trang hoặc quay lại sau ít phút.
        </p>
        <div className="mt-2 flex gap-2">
          <Button onClick={reset}>Thử lại</Button>
          <Button asChild variant="outline">
            <Link href="/">Về trang chủ</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
