import { SparkIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"

export function AiraTile({ large = false }: { large?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-background text-primary shadow-[inset_0_0_0_1px_var(--line)]",
        large ? "size-10 rounded-[var(--shape-card)]" : "size-7 rounded-md",
      )}
    >
      <SparkIcon size={large ? 20 : 16} />
    </span>
  )
}
