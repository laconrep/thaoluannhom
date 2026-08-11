"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { colorForIndex } from "@/lib/group-colors"

/* ============ CLASSES ============ */

export async function createClassAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Lớp mới"
  const capacity = Math.max(1, Math.min(80, Number(formData.get("capacity") ?? 48) || 48))
  const numGroups = Math.max(2, Math.min(12, Number(formData.get("numGroups") ?? 8) || 8))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: cls, error } = await supabase
    .from("classes")
    .insert({ teacher_id: user.id, name, capacity })
    .select()
    .single()
  if (error || !cls) throw new Error(error?.message ?? "Không tạo được lớp")

  // Tạo students slot trống
  const slots = Array.from({ length: capacity }, (_, i) => ({
    class_id: cls.id,
    slot_number: i + 1,
    name: null,
  }))
  await supabase.from("students").insert(slots)

  // Tạo nhóm cố định với màu riêng
  const groups = Array.from({ length: numGroups }, (_, i) => ({
    class_id: cls.id,
    group_number: i + 1,
    label: `Nhóm ${i + 1}`,
    name: `Nhóm ${i + 1}`,
    color: colorForIndex(i),
    display_order: i + 1,
  }))
  await supabase.from("class_groups").insert(groups)

  revalidatePath("/dashboard")
  redirect(`/classes/${cls.id}/roster`)
}

export async function deleteClassAction(classId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("classes").delete().eq("id", classId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function renameClassAction(classId: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("classes").update({ name }).eq("id", classId)
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/${classId}`)
}

export async function rotateShareTokenAction(classId: string) {
  const supabase = await createClient()
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20)
  const { error } = await supabase
    .from("classes")
    .update({ share_token: token })
    .eq("id", classId)
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/${classId}`)
}

/* ============ STUDENTS / ROSTER ============ */

export async function updateStudentNameAction(studentId: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("students")
    .update({ name: name.trim() || null })
    .eq("id", studentId)
  if (error) throw new Error(error.message)
}

export async function bulkSetNamesAction(classId: string, names: string[]) {
  const supabase = await createClient()
  const { data: students } = await supabase
    .from("students")
    .select("id, slot_number")
    .eq("class_id", classId)
    .order("slot_number")
  if (!students) return
  for (let i = 0; i < Math.min(students.length, names.length); i++) {
    const name = names[i]?.trim() || null
    await supabase.from("students").update({ name }).eq("id", students[i].id)
  }
  revalidatePath(`/classes/${classId}/roster`)
}

export async function setCapacityAction(classId: string, newCapacity: number) {
  const supabase = await createClient()
  const cap = Math.max(1, Math.min(80, newCapacity))
  const { data: cls } = await supabase
    .from("classes")
    .select("capacity")
    .eq("id", classId)
    .single()
  if (!cls) return
  if (cap > cls.capacity) {
    const rows = Array.from({ length: cap - cls.capacity }, (_, i) => ({
      class_id: classId,
      slot_number: cls.capacity + i + 1,
      name: null,
    }))
    await supabase.from("students").insert(rows)
  } else if (cap < cls.capacity) {
    await supabase.from("students").delete().eq("class_id", classId).gt("slot_number", cap)
  }
  await supabase.from("classes").update({ capacity: cap }).eq("id", classId)
  revalidatePath(`/classes/${classId}`)
}

/* ============ CLASS GROUPS ============ */

export async function addClassGroupAction(classId: string) {
  const supabase = await createClient()
  const { data: groups } = await supabase
    .from("class_groups")
    .select("group_number")
    .eq("class_id", classId)
    .order("group_number", { ascending: false })
    .limit(1)
  const nextNum = (groups?.[0]?.group_number ?? 0) + 1
  const { error } = await supabase.from("class_groups").insert({
    class_id: classId,
    group_number: nextNum,
    label: `Nhóm ${nextNum}`,
    name: `Nhóm ${nextNum}`,
    color: colorForIndex(nextNum - 1),
    display_order: nextNum,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/${classId}/roster`)
}

// Chuyển 1 HS sang nhóm mới; nếu HS đang ở nhóm khác trong cùng class, gỡ khỏi nhóm cũ
export async function moveStudentToGroupAction(
  studentId: string,
  targetGroupId: string | null,
  classId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  // Gỡ HS khỏi tất cả nhóm hiện tại trong lớp
  const { data: existing } = await supabase
    .from("class_group_members")
    .select("class_group_id, class_groups!inner(class_id)")
    .eq("student_id", studentId)
    .eq("class_groups.class_id", classId)
  const existingIds = (existing ?? []).map((e: any) => e.class_group_id)
  if (existingIds.length > 0) {
    await supabase
      .from("class_group_members")
      .delete()
      .eq("student_id", studentId)
      .in("class_group_id", existingIds)
  }

  if (targetGroupId) {
    const { error } = await supabase
      .from("class_group_members")
      .insert({ class_group_id: targetGroupId, student_id: studentId })
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath(`/classes/${classId}/roster`)
  return { ok: true }
}

export async function removeClassGroupAction(classGroupId: string, classId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("class_groups").delete().eq("id", classGroupId)
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/${classId}/roster`)
}

export async function setGroupMembersAction(
  classGroupId: string,
  studentIds: string[],
  classId: string,
) {
  const supabase = await createClient()
  await supabase.from("class_group_members").delete().eq("class_group_id", classGroupId)
  if (studentIds.length > 0) {
    await supabase
      .from("class_group_members")
      .insert(studentIds.map((sid) => ({ class_group_id: classGroupId, student_id: sid })))
  }
  revalidatePath(`/classes/${classId}/roster`)
}

/* ============ SESSIONS ============ */

export async function createSessionAction(
  classId: string,
  input: {
    title: string
    kind: "group" | "individual"
    durationSeconds: number
    useFixedGroups?: boolean
    groupCount?: number
  },
) {
  const supabase = await createClient()
  const useFixed = input.useFixedGroups ?? true
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      class_id: classId,
      title: input.title,
      kind: input.kind,
      duration_seconds: input.durationSeconds,
      use_fixed_groups: input.kind === "group" ? useFixed : false,
    })
    .select()
    .single()
  if (error || !session) throw new Error(error?.message ?? "Không tạo được phiên")

  if (input.kind === "group") {
    if (useFixed) {
      // Dùng nhóm cố định của lớp
      const { data: cgs } = await supabase
        .from("class_groups")
        .select("id, group_number, label, name")
        .eq("class_id", classId)
        .order("group_number")
      if (cgs) {
        await supabase.from("session_groups").insert(
          cgs.map((g) => ({
            session_id: session.id,
            class_group_id: g.id,
            group_number: g.group_number,
            label: g.name ?? g.label,
          })),
        )
      }
    } else {
      // Chia lại nhóm tạm cho phiên này
      const count = Math.max(2, Math.min(12, input.groupCount ?? 6))
      const rows = Array.from({ length: count }, (_, i) => ({
        session_id: session.id,
        class_group_id: null,
        group_number: i + 1,
        label: `Nhóm ${i + 1}`,
      }))
      await supabase.from("session_groups").insert(rows)
    }
  } else {
    const { data: students } = await supabase
      .from("students")
      .select("id, slot_number")
      .eq("class_id", classId)
      .order("slot_number")
    if (students) {
      await supabase.from("session_slots").insert(
        students.map((s) => ({
          session_id: session.id,
          slot_number: s.slot_number,
          student_id: s.id,
        })),
      )
    }
  }

  revalidatePath(`/classes/${classId}/sessions`)
  revalidatePath(`/classes/${classId}/individual`)
  if (input.kind === "individual") {
    redirect(`/classes/${classId}/individual/${session.id}`)
  }
  redirect(`/classes/${classId}/sessions/${session.id}`)
}

export async function startSessionAction(sessionId: string, durationSeconds: number) {
  const supabase = await createClient()
  const startedAt = new Date()
  const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000)
  const { error } = await supabase
    .from("sessions")
    .update({
      status: "running",
      duration_seconds: durationSeconds,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .eq("id", sessionId)
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/[id]/sessions/${sessionId}`, "page")
}

export async function pauseSessionAction(sessionId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("sessions")
    .update({ status: "idle", ends_at: null })
    .eq("id", sessionId)
  if (error) throw new Error(error.message)
}

export async function endSessionAction(sessionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").update({ status: "ended" }).eq("id", sessionId)
  if (error) throw new Error(error.message)
}

export async function reopenSessionAction(sessionId: string, extraSeconds: number) {
  const supabase = await createClient()
  const startedAt = new Date()
  const endsAt = new Date(startedAt.getTime() + Math.max(30, extraSeconds) * 1000)
  const { error } = await supabase
    .from("sessions")
    .update({
      status: "running",
      duration_seconds: extraSeconds,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .eq("id", sessionId)
  if (error) throw new Error(error.message)
}

export async function unlockGroupAction(sessionGroupId: string, clearSubmission = false) {
  const supabase = await createClient()
  // Mở khóa nhóm: trả claimed về false
  const { error } = await supabase
    .from("session_groups")
    .update({ claimed: false, claimed_at: null })
    .eq("id", sessionGroupId)
  if (error) throw new Error(error.message)

  if (clearSubmission) {
    await supabase.from("submissions").delete().eq("session_group_id", sessionGroupId)
    await supabase.from("annotations").delete().eq("session_group_id", sessionGroupId)
  }
}

export async function unlockSlotAction(sessionSlotId: string, clearSubmission = true) {
  const supabase = await createClient()
  // Mở khóa ô cá nhân: gỡ student_id để ô trở về trống, HS khác có thể chọn lại
  const { error } = await supabase
    .from("session_slots")
    .update({ student_id: null })
    .eq("id", sessionSlotId)
  if (error) throw new Error(error.message)

  if (clearSubmission) {
    await supabase.from("submissions").delete().eq("session_slot_id", sessionSlotId)
    await supabase.from("annotations").delete().eq("session_slot_id", sessionSlotId)
  }
}

export async function togglePasteAction(sessionId: string, allow: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("sessions")
    .update({ allow_paste: allow })
    .eq("id", sessionId)
  if (error) throw new Error(error.message)
}

export async function shareResultsAction(sessionId: string, share: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("sessions")
    .update({ results_shared_at: share ? new Date().toISOString() : null })
    .eq("id", sessionId)
  if (error) throw new Error(error.message)
}

export async function toggleDownloadAction(sessionId: string, allow: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("sessions")
    .update({ allow_download: allow })
    .eq("id", sessionId)
  if (error) throw new Error(error.message)
}

export async function deleteSessionAction(sessionId: string, classId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId)
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/${classId}/sessions`)
}

export async function toggleShareScoresAction(classId: string, shared: boolean) {
  const supabase = await createClient()
  const { data: cls } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .single()
  if (!cls) return
  // We flip all sessions' scores_shared per class? Instead use a field on class.
  // For simplicity share on all sessions at once.
  await supabase.from("sessions").update({ scores_shared: shared }).eq("class_id", classId)
  revalidatePath(`/classes/${classId}/gradebook`)
}

/* ============ ANNOTATIONS & SUBMISSIONS (teacher) ============ */

export async function saveAnnotationAction(args: {
  sessionId: string
  sessionGroupId?: string | null
  sessionSlotId?: string | null
  data: unknown
  score: number | null
}) {
  const supabase = await createClient()
  // Upsert via unique partial index; easier: find existing first
  const q = supabase.from("annotations").select("id").eq("session_id", args.sessionId)
  if (args.sessionGroupId) q.eq("session_group_id", args.sessionGroupId)
  else if (args.sessionSlotId) q.eq("session_slot_id", args.sessionSlotId)
  const { data: existing } = await q.maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from("annotations")
      .update({
        data: args.data,
        score: args.score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("annotations").insert({
      session_id: args.sessionId,
      session_group_id: args.sessionGroupId ?? null,
      session_slot_id: args.sessionSlotId ?? null,
      data: args.data,
      score: args.score,
    })
    if (error) throw new Error(error.message)
  }

  // Nếu đây là nhóm, cập nhật điểm cho tất cả thành viên của nhóm
  if (args.sessionGroupId && args.score !== null) {
    const { data: sg } = await supabase
      .from("session_groups")
      .select("class_group_id, session_id, label")
      .eq("id", args.sessionGroupId)
      .single()
    if (sg) {
      // Ưu tiên class_group_members (phiên dùng nhóm cố định), fallback session_group_members
      let studentIds: string[] = []
      if (sg.class_group_id) {
        const { data: members } = await supabase
          .from("class_group_members")
          .select("student_id")
          .eq("class_group_id", sg.class_group_id)
        studentIds = (members ?? []).map((m) => m.student_id)
      }
      if (studentIds.length === 0) {
        const { data: members } = await supabase
          .from("session_group_members")
          .select("student_id")
          .eq("session_group_id", args.sessionGroupId)
        studentIds = (members ?? []).map((m) => m.student_id)
      }
      for (const studentId of studentIds) {
        const { data: existed } = await supabase
          .from("student_scores")
          .select("id")
          .eq("session_id", sg.session_id)
          .eq("student_id", studentId)
          .maybeSingle()
        if (existed) {
          await supabase
            .from("student_scores")
            .update({
              score: args.score,
              group_name: sg.label,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existed.id)
        } else {
          await supabase.from("student_scores").insert({
            session_id: sg.session_id,
            student_id: studentId,
            score: args.score,
            group_name: sg.label,
          })
        }
      }
    }
  }
  // Nếu cá nhân, cập nhật điểm cho chính student
  if (args.sessionSlotId && args.score !== null) {
    const { data: ss } = await supabase
      .from("session_slots")
      .select("student_id, session_id")
      .eq("id", args.sessionSlotId)
      .single()
    if (ss?.student_id) {
      const { data: existed } = await supabase
        .from("student_scores")
        .select("id")
        .eq("session_id", ss.session_id)
        .eq("student_id", ss.student_id)
        .maybeSingle()
      if (existed) {
        await supabase
          .from("student_scores")
          .update({ score: args.score, updated_at: new Date().toISOString() })
          .eq("id", existed.id)
      } else {
        await supabase.from("student_scores").insert({
          session_id: ss.session_id,
          student_id: ss.student_id,
          score: args.score,
        })
      }
    }
  }
}

export async function overrideStudentScoreAction(
  sessionId: string,
  studentId: string,
  score: number | null,
) {
  const supabase = await createClient()
  const { data: existed } = await supabase
    .from("student_scores")
    .select("id")
    .eq("session_id", sessionId)
    .eq("student_id", studentId)
    .maybeSingle()
  if (existed) {
    await supabase
      .from("student_scores")
      .update({ score, updated_at: new Date().toISOString() })
      .eq("id", existed.id)
  } else {
    await supabase.from("student_scores").insert({
      session_id: sessionId,
      student_id: studentId,
      score,
    })
  }
}

/* ============ STUDENT SIDE ============ */

export async function studentSetNameAction(studentId: string, name: string, deviceToken: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("students")
    .update({ name: name.trim(), device_token: deviceToken })
    .eq("id", studentId)
  if (error) throw new Error(error.message)
}

export async function studentClaimGroupAction(
  sessionGroupId: string,
  _deviceToken?: string,
  studentId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  // Kiểm tra nhóm có tồn tại không
  const { data: sg } = await supabase
    .from("session_groups")
    .select("id, claimed, class_group_id, session_id")
    .eq("id", sessionGroupId)
    .maybeSingle()
  if (!sg) return { ok: false, error: "Không tìm thấy nhóm" }

  // Nếu chưa claim thì claim; nếu đã claim rồi thì cho HS khác cùng nhóm vào luôn
  if (!sg.claimed) {
    const { error } = await supabase
      .from("session_groups")
      .update({ claimed: true, claimed_at: new Date().toISOString() })
      .eq("id", sessionGroupId)
      .eq("claimed", false)
    if (error) return { ok: false, error: error.message }
  }

  // Với phiên chia lại (không có class_group_id), lưu HS vào session_group_members
  // để hệ thống biết ai thuộc nhóm nào (dùng cho tự gán điểm)
  if (studentId && !sg.class_group_id) {
    // Gỡ HS khỏi các nhóm khác trong cùng phiên (nếu lỡ claim nhầm)
    const { data: otherGroups } = await supabase
      .from("session_groups")
      .select("id")
      .eq("session_id", sg.session_id)
      .neq("id", sessionGroupId)
    const otherIds = (otherGroups ?? []).map((g) => g.id)
    if (otherIds.length > 0) {
      await supabase
        .from("session_group_members")
        .delete()
        .eq("student_id", studentId)
        .in("session_group_id", otherIds)
    }
    // Thêm vào nhóm hiện tại
    await supabase
      .from("session_group_members")
      .upsert(
        { session_group_id: sessionGroupId, student_id: studentId },
        { onConflict: "session_group_id,student_id" },
      )
  }
  return { ok: true }
}

export async function studentClaimSlotAction(
  sessionSlotId: string,
  _deviceToken: string,
  studentId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const patch: Record<string, unknown> = {}
  if (studentId) patch.student_id = studentId
  if (Object.keys(patch).length === 0) return { ok: true }
  const { error } = await supabase.from("session_slots").update(patch).eq("id", sessionSlotId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function submitGroupReportAction(args: {
  sessionId: string
  sessionGroupId: string
  textContent: string | null
  files: unknown
  isAuto?: boolean
}) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("session_group_id", args.sessionGroupId)
    .maybeSingle()
  const filesArr = Array.isArray(args.files) ? args.files : []
  const firstImage = filesArr.find(
    (f: any) => f && typeof f === "object" && f.kind === "image" && typeof f.url === "string",
  ) as { url?: string } | undefined
  if (existing) {
    const { error } = await supabase
      .from("submissions")
      .update({
        text_content: args.textContent,
        files: filesArr,
        image_url: firstImage?.url ?? null,
        submitted_at: new Date().toISOString(),
        is_auto_submitted: args.isAuto ?? false,
      })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("submissions").insert({
      session_id: args.sessionId,
      session_group_id: args.sessionGroupId,
      text_content: args.textContent,
      files: filesArr,
      image_url: firstImage?.url ?? null,
      is_auto_submitted: args.isAuto ?? false,
    })
    if (error) throw new Error(error.message)
  }
}

export async function submitIndividualReportAction(args: {
  sessionId: string
  sessionSlotId: string
  textContent: string | null
  files: unknown
  isAuto?: boolean
}) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("session_slot_id", args.sessionSlotId)
    .maybeSingle()
  const filesArr = Array.isArray(args.files) ? args.files : []
  const firstImage = filesArr.find(
    (f: any) => f && typeof f === "object" && f.kind === "image" && typeof f.url === "string",
  ) as { url?: string } | undefined
  if (existing) {
    const { error } = await supabase
      .from("submissions")
      .update({
        text_content: args.textContent,
        files: filesArr,
        image_url: firstImage?.url ?? null,
        submitted_at: new Date().toISOString(),
        is_auto_submitted: args.isAuto ?? false,
      })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("submissions").insert({
      session_id: args.sessionId,
      session_slot_id: args.sessionSlotId,
      text_content: args.textContent,
      files: filesArr,
      image_url: firstImage?.url ?? null,
      is_auto_submitted: args.isAuto ?? false,
    })
    if (error) throw new Error(error.message)
  }
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}
