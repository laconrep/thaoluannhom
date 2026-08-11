// Bảng màu cố định 8 nhóm — tương phản tốt, tương thích light + dark mode
export const GROUP_COLORS = [
  { hex: "#0d9488", label: "Teal" }, // 1
  { hex: "#d97706", label: "Amber" }, // 2
  { hex: "#2563eb", label: "Blue" }, // 3
  { hex: "#dc2626", label: "Red" }, // 4
  { hex: "#7c3aed", label: "Purple" }, // 5
  { hex: "#16a34a", label: "Green" }, // 6
  { hex: "#db2777", label: "Pink" }, // 7
  { hex: "#0891b2", label: "Cyan" }, // 8
  { hex: "#ca8a04", label: "Gold" }, // 9
  { hex: "#475569", label: "Slate" }, // 10
  { hex: "#ea580c", label: "Orange" }, // 11
  { hex: "#059669", label: "Emerald" }, // 12
] as const

export function colorForIndex(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length]!.hex
}

// Tạo style wrapper cho thẻ HS thuộc nhóm (nền nhạt + viền đậm theo màu nhóm)
export function groupCardStyle(color: string | null | undefined) {
  if (!color) return {}
  return {
    borderColor: color,
    backgroundColor: `${color}14`, // alpha ~8%
    boxShadow: `inset 4px 0 0 0 ${color}`,
  } as React.CSSProperties
}

// Dot + chip
export function groupPillStyle(color: string) {
  return {
    backgroundColor: `${color}22`,
    color,
    borderColor: color,
  } as React.CSSProperties
}
