import { Button } from "@/components/ui/button"
import { EditorIcon, SparkIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

const roomy = "group-has-[[data-text-format]]/toolbar:sr-only"

export function PanelSwitch({
  active,
  onPick,
}: {
  active: "agent" | "design"
  onPick?: (panel: "agent" | "design") => void
}) {
  const agent = active === "agent"
  return (
    <div
      className="inline-flex h-8 items-center rounded-lg bg-line p-0.5"
      role="group"
      aria-label="Panel"
      data-keeps-selection
    >
      <Button
        type="button"
        variant="ghost"
        aria-pressed={agent}
        className={cn(
          "h-7 gap-1.5 rounded-[var(--shape-control)] px-2.5 text-[length:var(--type-dense)] active:translate-y-0",
          agent
            ? "bg-white font-medium text-foreground shadow-[0px_1px_2px_var(--black-10)] hover:bg-white"
            : "text-quiet hover:bg-transparent",
        )}
        {...(onPick === undefined ? {} : { onClick: () => onPick("agent") })}
      >
        <SparkIcon size={14} className={agent ? "text-primary" : "text-quiet"} />
        <span className={roomy}>Agent</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-pressed={!agent}
        className={cn(
          "h-7 gap-1.5 rounded-[var(--shape-control)] px-2.5 text-[length:var(--type-dense)] active:translate-y-0",
          agent
            ? "text-quiet hover:bg-transparent"
            : "bg-white font-medium text-foreground shadow-[0px_1px_2px_var(--black-10)] hover:bg-white",
        )}
        {...(onPick === undefined ? {} : { onClick: () => onPick("design") })}
      >
        <EditorIcon name="sliders" size={14} />
        <span className={roomy}>Design</span>
      </Button>
    </div>
  )
}
