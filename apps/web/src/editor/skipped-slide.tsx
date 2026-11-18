import { EyeOff } from "lucide-react"
import { cn } from "@/lib/class-names"

export function SkippedSlide({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute right-2 bottom-2 grid size-6 place-items-center rounded-md bg-foreground text-white",
        className,
      )}
    >
      <EyeOff className="size-4" />
    </span>
  )
}
