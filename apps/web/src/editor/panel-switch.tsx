import { Button } from "@/components/ui/button"
import { EditorIcon, SparkIcon } from "@/components/ui/editor-icons"

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
        variant="panel-tab"
        size="compact"
        aria-pressed={agent}
        className="gap-1.5"
        {...(onPick === undefined ? {} : { onClick: () => onPick("agent") })}
      >
        <SparkIcon size={14} tone={agent ? "accent" : "quiet"} />
        <span className={roomy}>Agent</span>
      </Button>
      <Button
        type="button"
        variant="panel-tab"
        size="compact"
        aria-pressed={!agent}
        className="gap-1.5"
        {...(onPick === undefined ? {} : { onClick: () => onPick("design") })}
      >
        <EditorIcon name="sliders" size={14} />
        <span className={roomy}>Design</span>
      </Button>
    </div>
  )
}
