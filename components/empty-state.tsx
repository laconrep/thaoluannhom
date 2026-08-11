import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/30 px-6 py-12 flex flex-col items-center text-center gap-3",
        className,
      )}
    >
      <div className="size-14 rounded-full bg-primary/10 text-primary grid place-items-center">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className="font-heading font-semibold text-base text-pretty">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
