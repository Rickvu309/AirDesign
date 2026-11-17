import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { fitWidth, type SlideSize } from "@/editor/canvas-zoom"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
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
      variant="ghost"
      size="icon"
      aria-label={label}
      title={keys === undefined ? label : `${label} (${keys})`}
      className={cn(
        "rounded-lg text-[var(--white-80)] hover:bg-[var(--stage-hover)] hover:text-[var(--background)] active:translate-y-0",
        large ? "size-11" : "size-9",
      )}
      {...(onClick === undefined ? {} : { onClick })}
    >
      <EditorIcon name={icon} size={large ? 22 : 18} />
    </Button>
  )
}

export function StageTextButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-8 rounded-lg px-3 text-[length:var(--type-dense)] font-medium text-[var(--white-80)] shadow-[inset_0_0_0_1px_var(--stage-hover)] hover:bg-[var(--stage-hover)] hover:text-[var(--background)] active:translate-y-0"
      {...(onClick === undefined ? {} : { onClick })}
    >
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
  children,
}: {
  index: number
  size: SlideSize
  paint: SlidePaint
  className?: string
  mark?: string
  top?: boolean
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
          {paint(index, width)}
          {children}
        </div>
      ) : null}
    </div>
  )
}
