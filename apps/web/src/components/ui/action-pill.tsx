import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/class-names"

export function ActionPill({
  text,
  action,
  onAct,
  width,
  error = false,
}: {
  text: string
  action: string
  onAct: () => void
  width?: string
  error?: boolean
}) {
  return (
    <StatusPill error={error} layout="action" style={width === undefined ? undefined : { width }}>
      <span className="min-w-0 flex-1 py-1 leading-ui-tight text-pretty">{text}</span>
      <button
        type="button"
        className={cn(
          "flex h-7 shrink-0 items-center rounded-md px-2.5 font-medium whitespace-nowrap",
          error ? "hover:bg-black/4 active:bg-black/8" : "hover:bg-white/10 active:bg-white/15",
        )}
        onClick={onAct}
      >
        {action}
      </button>
    </StatusPill>
  )
}
