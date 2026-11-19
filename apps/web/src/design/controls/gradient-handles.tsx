import type { Paint } from "@airdesign/document"
import { useRef, type PointerEvent } from "react"
import { fillWords } from "@/copy/fill-copy"
import { shownHex, type Palette } from "@/design/color-choices"
import { cssGradient } from "@/paint-css"

type Gradient = Extract<Paint, { gradient: unknown }>["gradient"]
type Shade = Exclude<Gradient["shade"], { linear: unknown } | { path: unknown }>
type Handle = "center" | "angle" | "width" | "height"
type Point = { readonly x: number; readonly y: number }

const full = 100_000
const turn = 21_600_000
const minimumRadius = 1
const angleHandleRadius = 32_000

const inBounds = (position: number) => Math.round(Math.max(0, Math.min(full, position)))
const side = (center: number) => (center <= full / 2 ? 1 : -1)

function handles(shade: Shade): readonly (Point & { readonly handle: Handle })[] {
  if ("diamond" in shade) {
    const { x, y, width, height } = shade.diamond
    return [
      { handle: "center", x, y },
      { handle: "width", x: inBounds(x + side(x) * width), y },
      { handle: "height", x, y: inBounds(y + side(y) * height) },
    ]
  }
  const { x, y, angle } = shade.angular
  const radians = (angle / turn) * Math.PI * 2
  return [
    { handle: "center", x, y },
    {
      handle: "angle",
      x: inBounds(x + Math.sin(radians) * angleHandleRadius),
      y: inBounds(y - Math.cos(radians) * angleHandleRadius),
    },
  ]
}

function moved(shade: Shade, handle: Handle, x: number, y: number): Shade {
  if ("diamond" in shade) {
    const diamond = shade.diamond
    if (handle === "width") return { diamond: { ...diamond, width: Math.max(minimumRadius, Math.abs(x - diamond.x)) } }
    if (handle === "height")
      return { diamond: { ...diamond, height: Math.max(minimumRadius, Math.abs(y - diamond.y)) } }
    return { diamond: { ...diamond, x, y } }
  }
  const angular = shade.angular
  if (handle !== "angle") return { angular: { ...angular, x, y } }
  if (x === angular.x && y === angular.y) return shade
  const degrees = Math.atan2(x - angular.x, angular.y - y) / (Math.PI * 2)
  return { angular: { ...angular, angle: (Math.round(degrees * turn) + turn) % turn } }
}

function preview(shade: Shade, stops: Gradient["stops"], palette: Palette) {
  return cssGradient({
    type: "gradient",
    angle: null,
    path: null,
    editor: shade,
    stops: stops.map(({ pos, color }) => ({
      position: pos / full,
      color: { hex: shownHex(color, palette.templateColors), alpha: 1 },
    })),
  })
}

function place(shown: HTMLElement, shade: Shade, background: string) {
  shown.style.background = background
  for (const { handle, x, y } of handles(shade)) {
    const button = shown.querySelector<HTMLElement>(`[data-gradient-handle="${handle}"]`)
    if (button === null) continue
    button.style.left = `${x / 1000}%`
    button.style.top = `${y / 1000}%`
  }
}

export function GradientHandles({
  gradient,
  palette,
  onChange,
}: {
  readonly gradient: Gradient
  readonly palette: Palette
  readonly onChange: (value: Gradient) => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    readonly id: number
    readonly startX: number
    readonly startY: number
    readonly point: Point
  } | null>(null)
  const { shade, stops } = gradient
  if (!("angular" in shade) && !("diamond" in shade)) return null
  const background = preview(shade, stops, palette)

  function at(event: PointerEvent<HTMLButtonElement>, handle: Handle, source: Shade): Shade {
    const bounds = area.current?.getBoundingClientRect()
    const start = drag.current
    if (bounds === undefined || bounds.width === 0 || bounds.height === 0 || start?.id !== event.pointerId)
      return source
    const x = inBounds(start.point.x + ((event.clientX - start.startX) / bounds.width) * full)
    const y = inBounds(start.point.y + ((event.clientY - start.startY) / bounds.height) * full)
    return moved(source, handle, x, y)
  }

  return (
    <div
      ref={area}
      data-gradient-preview
      className="relative mx-2 h-24 rounded-[var(--shape-control)] shadow-[inset_0px_0px_0px_1px_var(--field-edge)]"
      style={{ background }}
    >
      {handles(shade).map(({ handle, x, y }) => (
        <button
          key={handle}
          type="button"
          aria-label={fillWords[`gradientHandle.${handle}`]}
          data-gradient-handle={handle}
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-foreground bg-background cursor-grab active:cursor-grabbing"
          style={{ left: `${x / 1000}%`, top: `${y / 1000}%` }}
          onPointerDown={(event) => {
            if (event.button !== 0 || drag.current !== null) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, point: { x, y } }
          }}
          onPointerMove={(event) => {
            if (drag.current?.id !== event.pointerId || area.current === null) return
            const next = at(event, handle, shade)
            place(area.current, next, preview(next, stops, palette))
          }}
          onPointerUp={(event) => {
            if (drag.current?.id !== event.pointerId) return
            const next = at(event, handle, shade)
            drag.current = null
            if (JSON.stringify(next) !== JSON.stringify(shade)) onChange({ ...gradient, shade: next })
          }}
          onLostPointerCapture={() => {
            if (drag.current === null) return
            drag.current = null
            if (area.current !== null) place(area.current, shade, background)
          }}
          onKeyDown={(event) => {
            const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
            if (!(event.key in keys)) return
            const [dx, dy] = keys[event.key as keyof typeof keys]!
            event.preventDefault()
            event.stopPropagation()
            const step = event.shiftKey ? 10_000 : 1_000
            const next = moved(shade, handle, inBounds(x + dx! * step), inBounds(y + dy! * step))
            onChange({ ...gradient, shade: next })
          }}
        />
      ))}
    </div>
  )
}
