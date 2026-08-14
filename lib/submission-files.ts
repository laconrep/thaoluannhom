import type { SubmissionFile, SubmissionRow } from "@/lib/types"

export function getFiles(sub: SubmissionRow | undefined): SubmissionFile[] {
  if (!sub) return []
  if (Array.isArray(sub.files) && sub.files.length > 0) return sub.files
  if (sub.image_url) {
    return [
      {
        url: sub.image_url,
        name: "ảnh.jpg",
        kind: "image",
        mime: "image/jpeg",
        rotation: 0,
      },
    ]
  }
  return []
}
