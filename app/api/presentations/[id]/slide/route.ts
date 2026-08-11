import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { slideNumber } = await request.json()

    if (typeof slideNumber !== "number" || slideNumber < 1) {
      return NextResponse.json({ error: "Invalid slide number" }, { status: 400 })
    }

    // Verify presentation exists and user is owner
    const { data: presentation, error: fetchError } = await supabase
      .from("presentations")
      .select("id, teacher_id, slide_count, session_id")
      .eq("id", id)
      .single()

    if (fetchError || !presentation) {
      return NextResponse.json({ error: "Presentation not found" }, { status: 404 })
    }

    if (presentation.teacher_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (slideNumber > presentation.slide_count) {
      return NextResponse.json({ error: "Slide number out of range" }, { status: 400 })
    }

    // Update current slide
    const { error: updateError } = await supabase
      .from("presentations")
      .update({ current_slide: slideNumber })
      .eq("id", id)

    if (updateError) {
      return NextResponse.json({ error: "Failed to update slide" }, { status: 500 })
    }

    // Broadcast update via Supabase Realtime
    return NextResponse.json({ success: true, currentSlide: slideNumber })
  } catch (error) {
    console.error("[v0] Slide update error:", error)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
