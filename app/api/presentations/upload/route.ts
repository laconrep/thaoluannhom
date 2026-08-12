import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

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

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const sessionId = formData.get("sessionId") as string | null
    const allowedTypes = new Set([
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/zip",
    ])

    if (!file || !sessionId || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Thiếu file hoặc sessionId" }, { status: 400 })
    }

    if (file.size === 0 || file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File PowerPoint phải từ 1 byte đến 50 MB." }, { status: 400 })
    }

    if (!allowedTypes.has(file.type) && !/\.(pptx?|PPTX?)$/.test(file.name)) {
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

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Estimate slide count from file size while preserving the original deck.
    const slideCount = getEstimatedSlideCount(buffer.length)

    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const timestamp = Date.now()
    const storagePath = `${user.id}/${sessionId}/${timestamp}_${fileName}`
    const { error: sourceUploadError } = await supabase.storage
      .from("presentations")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: false,
      })

    if (sourceUploadError) {
      return NextResponse.json({ error: `Không tải được file PowerPoint: ${sourceUploadError.message}` }, { status: 502 })
    }

    const { data: presentation, error: presentationError } = await supabase
      .from("presentations")
      .insert({
        session_id: sessionId,
        teacher_id: user.id,
        file_name: file.name,
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

    // Process and store slide images (create placeholder images for now)
    const slideInserts = []
    
    for (let i = 0; i < slideCount; i++) {
      try {
        // Create a placeholder image for each slide
        const slideImage = await sharp({
          create: {
            width: 1280,
            height: 720,
            channels: 3,
            background: { r: 240, g: 240, b: 240 },
          },
        })
          .png()
          .toBuffer()

        // Upload image to Supabase storage
        const imagePath = `${user.id}/${sessionId}/${timestamp}_${fileName}/slide_${i + 1}.png`
        const { error: uploadError } = await supabase.storage
          .from("presentations")
          .upload(imagePath, slideImage, {
            contentType: "image/png",
            upsert: false,
          })

        if (uploadError) {
          console.error(`[v0] Failed to upload slide image ${i + 1}:`, uploadError)
          continue
        }

        slideInserts.push({
          presentation_id: presentation.id,
          slide_number: i + 1,
          image_path: imagePath,
        })
      } catch (err) {
        console.error(`[v0] Error creating slide ${i + 1}:`, err)
      }
    }

    // Insert slide metadata
    if (slideInserts.length > 0) {
      const { error: slidesError } = await supabase
        .from("presentation_slides")
        .insert(slideInserts)

      if (slidesError) {
        console.error(`[v0] Failed to insert slide metadata:`, slidesError)
        return NextResponse.json({ error: "Failed to process slides" }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      presentation: {
        id: presentation.id,
        fileName: presentation.file_name,
        slideCount: presentation.slide_count,
      },
    })
  } catch (error) {
    console.error("[v0] Presentation upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
