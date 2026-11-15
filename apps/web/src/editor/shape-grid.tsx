import { presets, type Geometry, type Preset } from "@airdesign/document"
import { presetOutline } from "@airdesign/render"
import { Button } from "@/components/ui/button"
import { geometryWords } from "@/copy/geometry-copy"
import { shapeCopy } from "@/copy/shape-copy"
import { floatShadow } from "@/editor/editor-chrome"
import { basicShapes, LineArt, ShapeSvg } from "@/editor/tool-panels"
import { shapeFill, shapeStroke } from "@/editor/tool-panels-art"
import { cn } from "@/lib/class-names"

const thumbSide = 20

const drawnNatively: Readonly<Partial<Record<Preset, string>>> = { rect: "square", ellipse: "circle" }

function PresetThumb({ preset }: { preset: Preset }) {
  const native = drawnNatively[preset]
  if (native !== undefined) return <ShapeSvg markup={basicShapes[native] ?? ""} size={26} />
  if (preset === "line" || preset === "straightConnector1")
    return <LineArt arrow={preset === "straightConnector1"} size={22} />
  const paths = presetOutline(preset, thumbSide, thumbSide) ?? []
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} strokeWidth="1" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(2 2)">
        {paths.map((path, at) => (
          <path key={at} d={path.d} fill={path.fill ? shapeFill : "none"} stroke={path.stroke ? shapeStroke : "none"} />
        ))}
      </g>
    </svg>
  )
}

export function ShapeGrid({ onShape }: { onShape: (geometry: Geometry) => void }) {
  return (
    <div
      role="group"
      aria-label={shapeCopy.more}
      className={cn("grid w-[408px] grid-cols-11 gap-0.5 rounded-xl bg-white p-1.5", floatShadow)}
      data-shape-grid
    >
      {presets.map((preset) => (
        <Button
          key={preset}
          type="button"
          variant="ghost"
          aria-label={geometryWords[preset] ?? preset}
          title={geometryWords[preset] ?? preset}
          onClick={() => onShape(preset)}
          className="size-9 rounded-md p-0 hover:bg-line active:translate-y-0"
        >
          <PresetThumb preset={preset} />
        </Button>
      ))}
    </div>
  )
}
