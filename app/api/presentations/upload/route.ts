import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { PLAN_DEFAULT, planLimits, type Plan } from "@/lib/plans"

// Simplified: just assume PPTX has slides, we'll create placeholders
// In a real implementation, you'd parse the PPTX properly
function getEstimatedSlideCount(fileSize: number): number {
  // Rough estimate: average slide is ~50KB
  // Minimum 1 slide, maximum 100
  const estimated = Math.max(1, Math.min(100, Math.floor(fileSize / 50000)))
  return estimated
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Giới hạn số file trình chiếu mỗi giáo viên (quota phòng chống lạm dụng)
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
      supabase
        .from("presentations")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id),
    ])
    const plan = (profile?.plan as Plan | undefined) ?? PLAN_DEFAULT
    const maxPresentations = planLimits(plan).maxPresentations
    if (count !== null && count >= maxPresentations) {
      return NextResponse.json(
        { error: `Gói ${plan} giới hạn ${maxPresentations} bài trình chiếu. Hãy xóa bớt bài cũ hoặc nâng cấp gói.` },
        { status: 429 },
      )
    }

    const payload = await request.json()
    const fileName = typeof payload.fileName === "string" ? payload.fileName : ""
    const fileSize = Number(payload.fileSize)
    const fileType = typeof payload.fileType === "string" ? payload.fileType : ""
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
    const allowedTypes = new Set([
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/zip",
    ])

    if (!fileName || !sessionId || !Number.isFinite(fileSize)) {
      return NextResponse.json({ error: "Thiếu thông tin file hoặc sessionId" }, { status: 400 })
    }

    if (fileSize === 0 || fileSize > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File PowerPoint phải từ 1 byte đến 50 MB." }, { status: 400 })
    }

    if (!allowedTypes.has(fileType) && !/\.(pptx?|PPTX?)$/.test(fileName)) {
      return NextResponse.json({ error: "Chỉ hỗ trợ file PowerPoint .ppt hoặc .pptx." }, { status: 415 })
    }

    // Check session exists and user is teacher
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, class_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Verify user is teacher of this class
    const { data: cls } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", session.class_id)
      .single()

    if (!cls || cls.teacher_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to upload presentation" }, { status: 403 })
    }

    const slideCount = getEstimatedSlideCount(fileSize)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const timestamp = Date.now()
    const storagePath = `${user.id}/${sessionId}/${timestamp}_${safeFileName}`
    const { data: signedUpload, error: signedUploadError } = await supabase.storage
      .from("presentations")
      .createSignedUploadUrl(storagePath)

    if (signedUploadError || !signedUpload) {
      return NextResponse.json({ error: `Không tạo được đường dẫn upload: ${signedUploadError?.message ?? "unknown error"}` }, { status: 502 })
    }

    const { data: presentation, error: presentationError } = await supabase
      .from("presentations")
      .insert({
        session_id: sessionId,
        teacher_id: user.id,
        file_name: fileName,
        file_path: storagePath,
        storage_path: storagePath,
        slide_count: slideCount,
      })
      .select()
      .single()

    if (presentationError || !presentation) {
      await supabase.storage.from("presentations").remove([storagePath])
      return NextResponse.json({ error: `Không lưu được thông tin bài trình chiếu: ${presentationError?.message ?? "unknown error"}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      upload: { path: storagePath, token: signedUpload.token },
      presentation: {
        id: presentation.id,
        fileName: presentation.file_name,
        slideCount: presentation.slide_count,
      },
    })
  } catch (error) {
    console.error("Presentation upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
