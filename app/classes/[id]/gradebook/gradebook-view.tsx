"use client"

import { useMemo, useState, useTransition } from "react"
import { overrideStudentScoreAction, toggleShareScoresAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatDateShort } from "@/lib/utils-format"
import { Download, Share2 } from "lucide-react"

type Session = {
  id: string
  title: string
  kind: "group" | "individual"
  created_at: string
  scores_shared: boolean
}
type Student = { id: string; slot_number: number; name: string | null }

export function GradebookView({
  classId,
  shareToken,
  students,
  sessions,
  scoreMap: initialMap,
}: {
  classId: string
  shareToken: string
  students: Student[]
  sessions: Session[]
  scoreMap: Record<string, Record<string, number | null>>
}) {
  const [scoreMap, setScoreMap] = useState(initialMap)
  const [pending, startTransition] = useTransition()

  const anyShared = useMemo(() => sessions.some((s) => s.scores_shared), [sessions])

  const averages = useMemo(() => {
    const m: Record<string, number> = {}
    for (const st of students) {
      const vals = sessions
        .map((s) => scoreMap[st.id]?.[s.id])
        .filter((x): x is number => typeof x === "number")
      if (vals.length > 0) m[st.id] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return m
  }, [students, sessions, scoreMap])

  function saveScore(studentId: string, sessionId: string, value: string) {
    const parsed = value.trim() === "" ? null : Number(value)
    const score = Number.isFinite(parsed as number) ? (parsed as number) : null
    setScoreMap((cur) => ({
      ...cur,
      [studentId]: { ...(cur[studentId] ?? {}), [sessionId]: score },
    }))
    startTransition(() => {
      overrideStudentScoreAction(sessionId, studentId, score)
    })
  }

  function toggleShare() {
    startTransition(() => {
      toggleShareScoresAction(classId, !anyShared)
    })
  }

  function exportCSV() {
    const header = ["STT", "Họ tên", ...sessions.map((s) => s.title.replace(/,/g, " ")), "Trung bình"]
    const rows = students.map((st) => [
      st.slot_number,
      st.name ?? "",
      ...sessions.map((s) => scoreMap[st.id]?.[s.id] ?? ""),
      averages[st.id]?.toFixed(2) ?? "",
    ])
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bangdiem-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Bảng điểm</CardTitle>
            <CardDescription>
              Mỗi phiên là một cột điểm. Có thể điều chỉnh điểm thủ công. Xuất CSV để in.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
              <Download className="size-4" aria-hidden="true" />
              Xuất CSV
            </Button>
            <Button
              variant={anyShared ? "default" : "outline"}
              size="sm"
              onClick={toggleShare}
              disabled={pending}
              className="gap-2"
            >
              <Share2 className="size-4" aria-hidden="true" />
              {anyShared ? "Đang công khai" : "Công khai điểm"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Chưa có phiên nào để hiện điểm.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky left-0 bg-muted/40 px-2 py-2 text-left font-semibold w-10">
                      STT
                    </th>
                    <th className="sticky left-10 bg-muted/40 px-2 py-2 text-left font-semibold min-w-40">
                      Họ tên
                    </th>
                    {sessions.map((s) => (
                      <th
                        key={s.id}
                        className="px-2 py-2 text-center font-semibold min-w-24"
                      >
                        <div className="text-xs leading-tight line-clamp-2 text-pretty">
                          {s.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {s.kind === "group" ? "Nhóm" : "Cá nhân"} · {formatDateShort(s.created_at)}
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-semibold bg-primary/5">TB</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.id} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 bg-card px-2 py-1 text-muted-foreground tabular-nums">
                        {st.slot_number}
                      </td>
                      <td className="sticky left-10 bg-card px-2 py-1">
                        {st.name?.trim() || <span className="text-muted-foreground">—</span>}
                      </td>
                      {sessions.map((s) => {
                        const v = scoreMap[st.id]?.[s.id]
                        return (
                          <td key={s.id} className="px-1 py-1">
                            <Input
                              type="number"
                              step={0.25}
                              defaultValue={v ?? ""}
                              onBlur={(e) => saveScore(st.id, s.id, e.target.value)}
                              className="h-7 text-center text-xs"
                            />
                          </td>
                        )
                      })}
                      <td className="px-2 py-1 text-center font-bold text-primary tabular-nums bg-primary/5">
                        {averages[st.id]?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
