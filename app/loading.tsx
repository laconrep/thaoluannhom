import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return (
    <div className="min-h-svh bg-background flex items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  )
}
