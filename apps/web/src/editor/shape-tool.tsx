import type { Geometry } from "@airdesign/document"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { shapeCopy } from "@/copy/shape-copy"
import { floatShadow } from "@/editor/editor-chrome"
import { EditorIcon } from "@/editor/editor-icons"
import { basicShapes, LineArt, ShapeSvg, trayShapes } from "@/editor/tool-panels"
import { cn } from "@/lib/class-names"

const drawn: Readonly<Record<string, Geometry>> = { square: "rect", circle: "ellipse" }

const itemClass = "size-9 rounded-md p-0 hover:bg-line active:translate-y-0 disabled:opacity-40"

function TrayItem({
  label,
  geometry,
  onShape,
  children,
}: {
  label: string
  geometry: Geometry | undefined
  onShape: ((geometry: Geometry) => void) | undefined
  children: ReactNode
}) {
  const run = geometry === undefined || onShape === undefined ? undefined : () => onShape(geometry)
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      disabled={run === undefined}
      {...(run === undefined ? {} : { onClick: run })}
      className={itemClass}
    >
      {children}
    </Button>
  )
}

export function ShapeTrayItems({ onShape }: { onShape?: (geometry: Geometry) => void }) {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-xl bg-white p-1.5", floatShadow)} data-shape-tray>
      <TrayItem label={shapeCopy.line} geometry="line" onShape={onShape}>
        <LineArt arrow={false} size={22} />
      </TrayItem>
      <TrayItem label={shapeCopy.arrow} geometry={undefined} onShape={onShape}>
        <LineArt arrow size={22} />
      </TrayItem>
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      {trayShapes.map((name) => (
        <TrayItem key={name} label={shapeCopy.shapes[name] ?? name} geometry={drawn[name]} onShape={onShape}>
          <ShapeSvg markup={basicShapes[name] ?? ""} size={26} />
        </TrayItem>
      ))}
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      <Button
        type="button"
        variant="ghost"
        aria-label={shapeCopy.more}
        disabled
        className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium text-foreground disabled:opacity-40"
      >
        {shapeCopy.more}
      </Button>
    </div>
  )
}

export function ShapeTool({ onShape }: { onShape: (geometry: Geometry) => void }) {
  const [open, setOpen] = useState(false)
  const pick = (geometry: Geometry) => {
    setOpen(false)
    onShape(geometry)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent side="top" sideOffset={12} className="w-auto bg-transparent p-0 shadow-none ring-0 duration-0">
        <ShapeTrayItems onShape={pick} />
      </PopoverContent>
    </Popover>
  )
}
