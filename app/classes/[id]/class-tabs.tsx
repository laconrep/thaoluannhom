"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Users, PresentationIcon, ClipboardCheck, Table, Share2 } from "lucide-react"

export function ClassTabs({ classId }: { classId: string }) {
  const pathname = usePathname()
  const tabs = [
    { href: `/classes/${classId}/roster`, label: "Danh sách & nhóm", icon: Users },
    { href: `/classes/${classId}/sessions`, label: "Thảo luận nhóm", icon: PresentationIcon },
    { href: `/classes/${classId}/individual`, label: "Giao việc cá nhân", icon: ClipboardCheck },
    { href: `/classes/${classId}/gradebook`, label: "Bảng điểm", icon: Table },
    { href: `/classes/${classId}/share`, label: "Chia sẻ", icon: Share2 },
  ]
  return (
    <nav className="flex items-center gap-0 overflow-x-auto mt-4 -mb-px no-scrollbar">
      {tabs.map((t) => {
        const active = pathname?.startsWith(t.href)
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 transition relative",
              active
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
