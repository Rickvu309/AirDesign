import type { Geometry } from "@airdesign/document"
import { useState, type ReactNode, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { shapeCopy } from "@/copy/shape-copy"
import { floatShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { ShapeGrid } from "@/editor/shape-grid"
import { basicShapes, LineArt, ShapeSvg, trayShapes } from "@/editor/shape-marks"
import { cn } from "@/lib/class-names"

const trayNames: Readonly<Record<string, Geometry>> = {
  square: "rect",
  circle: "ellipse",
  diamond: "diamond",
  triangle: "triangle",
  star: "star5",
  plus: "plus",
  arrowl: "leftArrow",
  arrowr: "rightArrow",
  bubble: "wedgeRectCallout",
}

export const trayGeometries: Readonly<Record<string, Geometry>> = {
  [shapeCopy.line]: "line",
  [shapeCopy.arrow]: "straightConnector1",
  ...Object.fromEntries(trayShapes.map((name) => [shapeCopy.shapes[name] ?? name, trayNames[name]])),
}

const itemClass = "size-9 rounded-md p-0 hover:bg-line active:translate-y-0"

function TrayItem({
  label,
  onShape,
  children,
}: {
  label: string
  onShape: (geometry: Geometry) => void
  children: ReactNode
}) {
  const geometry = trayGeometries[label]
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      onClick={() => geometry !== undefined && onShape(geometry)}
      className={itemClass}
    >
      {children}
    </Button>
  )
}

export function ShapeTrayItems({ onShape, onMore }: { onShape: (geometry: Geometry) => void; onMore: () => void }) {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-xl bg-white p-1.5", floatShadow)} data-shape-tray>
      <TrayItem label={shapeCopy.line} onShape={onShape}>
        <LineArt arrow={false} size={22} />
      </TrayItem>
      <TrayItem label={shapeCopy.arrow} onShape={onShape}>
        <LineArt arrow size={22} />
      </TrayItem>
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      {trayShapes.map((name) => {
        const label = shapeCopy.shapes[name] ?? name
        return (
          <TrayItem key={name} label={label} onShape={onShape}>
            <ShapeSvg markup={basicShapes[name] ?? ""} size={26} />
          </TrayItem>
        )
      })}
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      <Button
        type="button"
        variant="ghost"
        aria-label={shapeCopy.more}
        onClick={onMore}
        className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium text-foreground"
      >
        {shapeCopy.more}
      </Button>
    </div>
  )
}

export type ShapesShown = "tray" | "grid"

export function ShapeTool({
  onShape,
  anchor,
  shown,
}: {
  onShape: (geometry: Geometry) => void
  anchor?: RefObject<HTMLElement | null>
  shown?: ShapesShown
}) {
  const [open, setOpen] = useState(shown !== undefined)
  const [more, setMore] = useState(shown === "grid")
  const change = (next: boolean) => {
    setOpen(next)
    setMore(false)
  }
  const pick = (geometry: Geometry) => {
    change(false)
    onShape(geometry)
  }
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={shapeCopy.tool}
            className="size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0 data-[popup-open]:bg-primary data-[popup-open]:text-primary-foreground"
          />
        }
      >
        <EditorIcon name="shape" size={18} />
      </PopoverTrigger>
      <PopoverContent
        anchor={anchor}
        side="top"
        sideOffset={12}
        className="w-auto bg-transparent p-0 shadow-none ring-0 duration-0"
        data-keeps-format
        {...(shown === undefined ? {} : { initialFocus: false })}
      >
        {more ? <ShapeGrid onShape={pick} /> : <ShapeTrayItems onShape={pick} onMore={() => setMore(true)} />}
      </PopoverContent>
    </Popover>
  )
}
