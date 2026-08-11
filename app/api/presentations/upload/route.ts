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
    const file = formData.get("file") as File
    const sessionId = formData.get("sessionId") as string

    if (!file || !sessionId) {
      return NextResponse.json({ error: "Missing file or sessionId" }, { status: 400 })
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

    // Estimate slide count from file size (simplified approach)
    // For production, you'd want to actually parse the PPTX
    const slideCount = getEstimatedSlideCount(buffer.length)

    // Create presentation record
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const timestamp = Date.now()
    const storagePath = `presentations/${sessionId}/${timestamp}_${fileName}`

    const { data: presentation, error: presentationError } = await supabase
      .from("presentations")
      .insert({
        session_id: sessionId,
        teacher_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        slide_count: slideCount,
      })
      .select()
      .single()

    if (presentationError || !presentation) {
      return NextResponse.json({ error: "Failed to create presentation record" }, { status: 500 })
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
        const imagePath = `${storagePath}/slide_${i + 1}.png`
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
