import type { ReactNode } from "react"
import type { Point } from "./slide-geometry"

export function chromeScale(drawn: number): string {
  return `calc(${String(drawn)} / var(--shown-scale, ${String(drawn)}))`
}

export function screenLine(width: number) {
  return { strokeWidth: `calc(${String(width)}px * var(--chrome-scale, 1))` }
}

export function ScreenSized({
  at,
  turn = 0,
  children,
}: {
  readonly at: Point
  readonly turn?: number
  readonly children: ReactNode
}) {
  return (
    <g transform={`translate(${String(at.x)} ${String(at.y)}) rotate(${String(turn)})`}>
      <g style={{ scale: "var(--chrome-scale, 1)" }}>{children}</g>
    </g>
  )
}
