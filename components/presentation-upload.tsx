"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Presentation, Upload, X } from "lucide-react"
import { toast } from "sonner"

export function PresentationUpload({
  sessionId,
  onUploadSuccess,
}: {
  sessionId: string
  onUploadSuccess: (presentation: any) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [presentation, setPresentation] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!/\.pptx?$/i.test(file.name)) {
      toast.error("Chỉ hỗ trợ file PowerPoint (.ppt hoặc .pptx)")
      return
    }
    if (file.size === 0 || file.size > 50 * 1024 * 1024) {
      toast.error("File PowerPoint phải từ 1 byte đến 50 MB")
      return
    }

    // Kiểm tra magic number: pptx là ZIP (PK), ppt là OLE2 (D0 CF 11 E0)
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    const isZip =
      head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2])
    const isOle =
      head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0
    if (!isZip && !isOle) {
      toast.error("File không đúng định dạng PowerPoint. Hãy chọn file .ppt hoặc .pptx hợp lệ.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/presentations/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      })

      if (!response.ok) {
        let error: string
        try {
          const errorData = await response.json()
          error = errorData.error || `Upload failed with status ${response.status}`
        } catch {
          error = `Upload failed with status ${response.status}`
        }
        throw new Error(error)
      }

      const data = await response.json()
      const { error: storageError } = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/presentations/${data.upload.path}?token=${encodeURIComponent(data.upload.token)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "x-upsert": "false",
          },
          body: file,
        },
      ).then(async (uploadResponse) => ({
        error: uploadResponse.ok ? null : new Error(`Storage upload failed with status ${uploadResponse.status}`),
      }))
      if (storageError) throw storageError

      setPresentation(data.presentation)
      onUploadSuccess(data.presentation)
      toast.success(`Tải lên thành công: ${data.presentation.slideCount} slide`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lỗi khi tải lên"
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  return (
    <div className="space-y-4">
      {!presentation ? (
        <div
          className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileSelect(file)
              }
            }}
          />

          <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {isLoading ? "Đang tải lên..." : "Kéo file PowerPoint vào đây hoặc click để chọn"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Hỗ trợ .ppt và .pptx, tối đa 50 MB</p>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Presentation className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{presentation.fileName}</p>
              <p className="text-xs text-muted-foreground">{presentation.slideCount} slide</p>
            </div>
          </div>
          <Button
            onClick={() => setPresentation(null)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
