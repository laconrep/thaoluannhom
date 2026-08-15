"use client"

import { useState, useTransition } from "react"
import { createClassAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Plus } from "lucide-react"

export function CreateClassCard() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <div>
        <Button size="lg" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="size-4" aria-hidden="true" />
          Tạo lớp mới
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo lớp mới</CardTitle>
        <CardDescription>
          Sĩ số là số chỗ cho học sinh. Mỗi học sinh sẽ có một ô riêng dùng cho mọi buổi học.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={async (fd) => {
            setError(null)
            startTransition(async () => {
              try {
                await createClassAction(fd)
              } catch (caught) {
                // redirect() làm server action trả promise reject với lỗi NEXT_REDIRECT.
                // Không phải lỗi thật — navigation vẫn do router xử lý.
                const digest = (caught as { digest?: string } | null)?.digest ?? ""
                if (digest.startsWith("NEXT_REDIRECT")) return
                const message = caught instanceof Error ? caught.message : "Không thể tạo lớp. Vui lòng thử lại."
                setError(message)
              }
            })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Tên lớp</FieldLabel>
              <Input id="name" name="name" placeholder="Ví dụ: 12A1 - Văn" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="capacity">Sĩ số</FieldLabel>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={80}
                defaultValue={48}
                required
              />
              <FieldDescription>Mặc định 48. Có thể điều chỉnh sau.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="numGroups">Số nhóm cố định</FieldLabel>
              <Input
                id="numGroups"
                name="numGroups"
                type="number"
                min={2}
                max={12}
                defaultValue={8}
                required
              />
              <FieldDescription>
                Mỗi phiên thảo luận nhóm sẽ dùng cấu trúc này. Có thể thay đổi sau.
              </FieldDescription>
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending && <Spinner className="mr-2" />}
                Tạo lớp
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
