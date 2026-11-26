import { Button } from "@/components/ui/button"
import { editorCopy } from "@/copy/editor-copy"
import { cn } from "@/lib/class-names"

export function PanelToggle({
  open,
  working,
  onOpen,
}: {
  readonly open: boolean
  readonly working: boolean
  readonly onOpen: (open: boolean) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={editorCopy.sidePanel}
      aria-expanded={open}
      aria-controls="editor-panel"
      title={editorCopy.sidePanel}
      data-panel-toggle
      data-view-toggle
      data-keeps-selection
      className="relative size-8 rounded-lg text-foreground active:translate-y-0 aria-expanded:bg-transparent aria-expanded:hover:bg-muted"
      onClick={() => onOpen(!open)}
    >
      <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true">
        <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.25" />
        <path d="M10 3v10" stroke="currentColor" strokeWidth="1.25" />
        <rect
          x="10.6"
          y="3.4"
          width="3"
          height="9.2"
          rx="1.4"
          fill="currentColor"
          className={cn(
            "transition-opacity duration-150 ease-out motion-reduce:transition-none",
            open ? "opacity-20" : "opacity-0",
          )}
        />
      </svg>
      {working && !open ? (
        <span
          data-panel-working
          className="absolute top-1 right-1 size-1.5 rounded-full bg-primary ring-2 ring-white motion-safe:animate-pulse"
        />
      ) : null}
    </Button>
  )
}
