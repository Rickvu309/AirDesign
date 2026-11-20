import { chartKinds, type ChartKind } from "@airdesign/document"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { chartCopy } from "@/copy/chart-copy"
import { floatShadow } from "@/editor/editor-chrome"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export const chartKindIcons: Readonly<Record<ChartKind, EditorIconName>> = {
  bar: "chartColumns",
  stacked: "chartStacked",
  stacked100: "chartStacked100",
  horizontal: "chartHorizontal",
  waterfall: "chartWaterfall",
  line: "chartLine",
  pie: "chartPie",
}

export function ChartKinds({ onChart }: { onChart: (kind: ChartKind) => void }) {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-xl bg-white p-1.5", floatShadow)} data-chart-menu>
      {chartKinds.map((kind) => (
        <Button
          key={kind}
          type="button"
          variant="ghost"
          aria-label={chartCopy.kinds[kind]}
          onClick={() => onChart(kind)}
          className="h-9 gap-1.5 rounded-md px-2.5 text-[length:var(--type-dense)] text-foreground hover:bg-line active:translate-y-0"
        >
          <EditorIcon name={chartKindIcons[kind]} size={18} />
          {chartCopy.types[kind]}
        </Button>
      ))}
    </div>
  )
}

export function ChartTool({ onChart }: { onChart: (kind: ChartKind) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={chartCopy.tool}
            className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0 data-[popup-open]:bg-primary data-[popup-open]:text-primary-foreground"
          />
        }
      >
        <EditorIcon name="chart" size={18} />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={12}
        className="w-auto bg-transparent p-0 shadow-none ring-0 duration-0"
        data-keeps-format
      >
        <ChartKinds
          onChart={(kind) => {
            setOpen(false)
            onChart(kind)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
