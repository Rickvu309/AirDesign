import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { fitWidth, type SlideSize } from "@/editing/canvas-zoom"
import { EditorIcon, type EditorIconName } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"
import { useRoom } from "@/present/present-room"

export type SlidePaint = (index: number, width: number) => ReactNode

export function StageButton({
  icon,
  label,
  keys,
  onClick,
  large = false,
}: {
  icon: EditorIconName
  label: string
  keys?: string
  onClick?: () => void
  large?: boolean
}) {
  return (
    <Button
      type="button"
      variant="stage"
      size="icon"
      aria-label={label}
      title={keys === undefined ? label : `${label} (${keys})`}
      className={large ? "size-11" : "size-9"}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <EditorIcon name={icon} size={large ? 22 : 18} />
    </Button>
  )
}

export function StageTextButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Button type="button" variant="stage" size="dense" {...(onClick === undefined ? {} : { onClick })}>
      {label}
    </Button>
  )
}

export function FittedSlide({
  index,
  size,
  paint,
  className,
  mark,
  top = false,
  layers,
  children,
}: {
  index: number
  size: SlideSize
  paint: SlidePaint
  className?: string
  mark?: string
  top?: boolean
  layers?: (width: number) => ReactNode
  children?: ReactNode
}) {
  const { room, onRoom } = useRoom()
  const width = room === null ? 0 : fitWidth(room, size)
  const height = size.width <= 0 ? 0 : Math.round((width * size.height) / size.width)
  return (
    <div
      ref={onRoom}
      className={cn("flex min-h-0 min-w-0 justify-center", top ? "items-start" : "items-center", className)}
    >
      {width > 0 ? (
        <div
          data-present-slide={mark ?? index + 1}
          className="relative shrink-0 overflow-hidden bg-[var(--background)]"
          style={{ width, height }}
        >
          {layers === undefined ? paint(index, width) : layers(width)}
          {children}
        </div>
      ) : null}
    </div>
  )
}
