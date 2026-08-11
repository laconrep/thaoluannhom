export type ClassRow = {
  id: string
  teacher_id: string
  name: string
  capacity: number
  share_token: string
  created_at: string
}

export type StudentRow = {
  id: string
  class_id: string
  slot_number: number
  name: string | null
  device_token: string | null
  created_at: string
}

export type ClassGroupRow = {
  id: string
  class_id: string
  group_number: number
  label: string
  name: string
  color: string
  display_order: number
}

export type ClassGroupMember = {
  class_group_id: string
  student_id: string
}

export type SessionKind = "group" | "individual"
export type SessionStatus = "idle" | "running" | "ended"

export type SessionRow = {
  id: string
  class_id: string
  title: string
  kind: SessionKind
  duration_seconds: number
  started_at: string | null
  ends_at: string | null
  status: SessionStatus
  scores_shared: boolean
  allow_paste: boolean
  results_shared_at: string | null
  allow_download: boolean
  use_fixed_groups: boolean
  created_at: string
}

export type AnnotationStamp = {
  kind: "stamp"
  label: string // e.g. "✓ Tốt", "★ Xuất sắc", "⚠ Xem lại", "❌ Sai"
  color: string
  x: number
  y: number
  fontSize: number
  fileIndex?: number
}

export type SessionGroupRow = {
  id: string
  session_id: string
  class_group_id: string | null
  group_number: number
  label: string
  claimed: boolean
  claimed_at: string | null
}

export type SessionSlotRow = {
  id: string
  session_id: string
  slot_number: number
  student_id: string | null
}

export type SubmissionFileKind = "image" | "pdf" | "docx" | "pptx" | "other"

export type SubmissionFile = {
  url: string
  name: string
  kind: SubmissionFileKind
  mime: string
  rotation?: number // degrees: 0, 90, 180, 270
}

export type SubmissionRow = {
  id: string
  session_id: string
  session_group_id: string | null
  session_slot_id: string | null
  image_url: string | null
  text_content: string | null
  files: SubmissionFile[]
  submitted_at: string
  is_auto_submitted: boolean
}

export type AnnotationDrawPath = {
  kind: "path"
  color: string
  width: number
  points: { x: number; y: number }[]
  fileIndex?: number
}
export type AnnotationText = {
  kind: "text"
  color: string
  x: number
  y: number
  text: string
  fontSize: number
  fileIndex?: number
}
export type AnnotationHighlight = {
  kind: "highlight"
  color: string
  x: number
  y: number
  w: number
  h: number
  fileIndex?: number
}
export type AnnotationUnderline = {
  kind: "underline"
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
  fileIndex?: number
}
export type AnnotationItem =
  | AnnotationDrawPath
  | AnnotationText
  | AnnotationHighlight
  | AnnotationUnderline
  | AnnotationStamp

export type AnnotationRow = {
  id: string
  session_id: string
  session_group_id: string | null
  session_slot_id: string | null
  data: AnnotationItem[]
  score: number | null
  updated_at: string
}

export type StudentScoreRow = {
  id: string
  session_id: string
  student_id: string
  score: number | null
  group_name: string | null
  updated_at: string
}
