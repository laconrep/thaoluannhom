"use client"

import { useState, useTransition } from "react"
import { rotateShareTokenAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, RotateCw, QrCode, ExternalLink } from "lucide-react"

export function ShareView({
  classId,
  shareToken,
  className,
}: {
  classId: string
  shareToken: string
  className: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const classUrl = `${origin}/c/${shareToken}`
  const gradesUrl = `${origin}/c/${shareToken}/grades`

  function copy(url: string, key: string) {
    navigator.clipboard.writeText(url)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function rotate() {
    if (!confirm("Đổi link? Link cũ sẽ không dùng được nữa.")) return
    startTransition(() => {
      rotateShareTokenAction(classId)
    })
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Link vào lớp cho học sinh</CardTitle>
          <CardDescription>
            Gửi link này cho học sinh để các em vào lớp, nhập tên vào ô, và tham gia các phiên thảo
            luận khi giáo viên mở.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="flex-1 text-xs truncate">{classUrl}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(classUrl, "class")}>
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {copied === "class" && <p className="text-xs text-primary">Đã copy!</p>}
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={classUrl} target="_blank" rel="noreferrer" className="gap-1">
                <ExternalLink className="size-4" aria-hidden="true" />
                Thử mở
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={rotate} className="gap-1">
              <RotateCw className="size-4" aria-hidden="true" />
              Đổi link
            </Button>
          </div>

          <div className="rounded-md border bg-card p-3 flex flex-col items-center gap-2">
            <QrCode className="size-5 text-muted-foreground" aria-hidden="true" />
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                classUrl,
              )}`}
              alt="QR code lớp học"
              width={200}
              height={200}
              className="rounded"
            />
            <p className="text-xs text-muted-foreground">Chiếu cho cả lớp quét</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Link xem điểm</CardTitle>
          <CardDescription>
            Học sinh có thể xem điểm của các bạn trong lớp (chỉ xem, không sửa được). Bác có thể
            bật/tắt chia sẻ ở tab Bảng điểm.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="flex-1 text-xs truncate">{gradesUrl}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(gradesUrl, "grades")}>
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {copied === "grades" && <p className="text-xs text-primary">Đã copy!</p>}
        </CardContent>
      </Card>
    </div>
  )
}
