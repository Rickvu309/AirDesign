import { presetOutline } from "@airdesign/doom"
import type { KeyboardEvent, Ref } from "react"
import { Button } from "@/components/ui/button"
import { geometryWords } from "@/copy/geometry-copy"
import { shapeCopy } from "@/copy/shape-copy"
import { floatShadow } from "@/components/ui/shadows"
import { basicShapes, LineArt, ShapeSvg } from "@/design/shape-marks"
import { shapeFill, shapeStroke } from "@/design/shape-marks-art"
import { cn } from "@/lib/class-names"

const thumbSide = 20

export const gridColumns = 11

export const moreShapes: readonly string[] = [
  "rect",
  "roundRect",
  "ellipse",
  "triangle",
  "rtTriangle",
  "diamond",
  "parallelogram",
  "trapezoid",
  "pentagon",
  "hexagon",
  "octagon",
  "homePlate",
  "chevron",
  "plus",
  "frame",
  "corner",
  "star4",
  "star5",
  "line",
  "straightConnector1",
  "rightArrow",
  "leftArrow",
  "upArrow",
  "downArrow",
  "leftRightArrow",
  "leftRightArrowCallout",
  "upDownArrow",
  "notchedRightArrow",
  "round1Rect",
  "round2SameRect",
  "snip1Rect",
  "snip2DiagRect",
  "wedgeRectCallout",
  "wedgeRoundRectCallout",
  "pieWedge",
  "flowChartProcess",
  "flowChartDecision",
  "flowChartTerminator",
  "bracketPair",
  "bracePair",
  "donut",
  "arc",
  "can",
  "cube",
  "rightBrace",
  "leftBrace",
  "cloud",
  "flowChartInputOutput",
  "flowChartManualOperation",
  "flowChartMerge",
  "flowChartExtract",
  "flowChartPreparation",
  "flowChartManualInput",
  "flowChartOffpageConnector",
  "flowChartPunchedCard",
]

const drawnNatively: Readonly<Record<string, string>> = { rect: "square", ellipse: "circle" }

export function PresetThumb({ preset, size = 26 }: { preset: string; size?: number }) {
  const native = drawnNatively[preset]
  if (native !== undefined) return <ShapeSvg markup={basicShapes[native] ?? ""} size={size} />
  if (preset === "line" || preset === "straightConnector1")
    return <LineArt arrow={preset === "straightConnector1"} size={size - 4} />
  const paths = presetOutline(preset, thumbSide, thumbSide) ?? []
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth="1" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(2 2)">
        {paths.map((path, at) => (
          <path key={at} d={path.d} fill={path.fill ? shapeFill : "none"} stroke={path.stroke ? shapeStroke : "none"} />
        ))}
      </g>
    </svg>
  )
}

export function gridStep(key: string, at: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return Math.min(at + 1, count - 1)
    case "ArrowLeft":
      return Math.max(at - 1, 0)
    case "ArrowDown":
      return at + gridColumns < count ? at + gridColumns : at
    case "ArrowUp":
      return at - gridColumns >= 0 ? at - gridColumns : at
    case "Home":
      return 0
    case "End":
      return count - 1
    default:
      return null
  }
}

function moveFocus(event: KeyboardEvent<HTMLDivElement>): void {
  const thumbs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")]
  const at = thumbs.findIndex((thumb) => thumb === document.activeElement)
  const next = at < 0 ? null : gridStep(event.key, at, thumbs.length)
  if (next === null) return
  event.preventDefault()
  thumbs[next]?.focus()
}

export function ShapeGrid({
  onShape,
  label = shapeCopy.more,
  shapes = moreShapes,
  chosen = null,
  chosenRef,
}: {
  onShape: (shape: string) => void
  label?: string
  shapes?: readonly string[]
  chosen?: string | null
  chosenRef?: Ref<HTMLButtonElement>
}) {
  const reached = chosen !== null && shapes.includes(chosen) ? chosen : shapes[0]
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid w-[408px] grid-cols-11 gap-0.5 rounded-xl bg-white p-1.5", floatShadow)}
      onKeyDown={moveFocus}
      data-shape-grid
    >
      {shapes.map((preset) => (
        <Button
          key={preset}
          ref={preset === reached ? chosenRef : undefined}
          type="button"
          variant="ghost"
          aria-label={geometryWords[preset] ?? preset}
          aria-pressed={chosen === null ? undefined : preset === chosen}
          title={geometryWords[preset] ?? preset}
          tabIndex={preset === reached ? 0 : -1}
          onClick={() => onShape(preset)}
          className="size-9 rounded-md p-0 hover:bg-line active:translate-y-0 aria-pressed:bg-line aria-pressed:ring-1 aria-pressed:ring-primary"
        >
          <PresetThumb preset={preset} />
        </Button>
      ))}
    </div>
  )
}
