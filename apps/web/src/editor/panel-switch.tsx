import { Button } from "@/components/ui/button"
import { EditorIcon, SparkIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/utils"

export function PanelSwitch({ active }: { active: "agent" | "design" }) {
  const agent = active === "agent"
  return (
    <div className="inline-flex h-8 items-center rounded-[8px] bg-line p-0.5" role="group" aria-label="Panel">
      <Button
        type="button"
        variant="ghost"
        aria-pressed={agent}
        className={cn(
          "h-7 gap-1.5 rounded-[6px] px-2.5 text-[13px] active:translate-y-0",
          agent ? "bg-white font-medium text-foreground shadow-[0px_1px_2px_#0000001a] hover:bg-white" : "text-quiet hover:bg-transparent",
        )}
      >
        <SparkIcon size={14} className={agent ? "text-primary" : "text-quiet"} />
        Agent
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-pressed={!agent}
        className={cn(
          "h-7 gap-1.5 rounded-[6px] px-2.5 text-[13px] active:translate-y-0",
          agent ? "text-quiet hover:bg-transparent" : "bg-white font-medium text-foreground shadow-[0px_1px_2px_#0000001a] hover:bg-white",
        )}
      >
        <EditorIcon name="sliders" size={14} />
        Design
      </Button>
    </div>
  )
}
