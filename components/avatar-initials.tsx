import { cn } from "@/lib/utils"

// Hàm hash ổn định -> 10 màu có sẵn trong globals.css
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h)
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  // Tiếng Việt: lấy chữ cái đầu của họ và chữ cái đầu của tên cuối
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AvatarInitials({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string | null | undefined
  seed?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const initials = getInitials(name)
  const key = seed ?? name ?? initials
  const colorIdx = hashString(key) % 10
  const sizeClass =
    size === "xs"
      ? "size-6 text-[9px]"
      : size === "sm"
        ? "size-8 text-xs"
        : size === "md"
          ? "size-10 text-sm"
          : size === "lg"
            ? "size-12 text-base"
            : "size-16 text-xl"

  return (
    <div
      className={cn(
        "rounded-full grid place-items-center font-semibold tracking-wide shrink-0 select-none",
        `avatar-color-${colorIdx}`,
        sizeClass,
        className,
      )}
      aria-hidden={!name ? "true" : undefined}
      title={name ?? undefined}
    >
      {initials}
    </div>
  )
}
