import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"
import type { RulerTick } from "./ruler-scale.js"
import type { Axis } from "./snapping.js"

export const rulerSize = 20
const labelGlyph = 6
const labelGap = 4
const chipHalf = 16

export function crisp(pixels: number): number {
  return Math.round(pixels) + 0.5
}

const rulerText: CSSProperties = {
  fontSize: "var(--ruler-text-size)",
  fontVariantNumeric: "tabular-nums",
  userSelect: "none",
}

export type Mark = { readonly at: number; readonly label: string; readonly paint: string; readonly chip?: true }

export function RulerBand(props: {
  readonly axis: Axis
  readonly length: number
  readonly ticks: readonly RulerTick[]
  readonly band: readonly [number, number] | null
  readonly marks: readonly Mark[]
  readonly onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const { axis, length, ticks, band, marks } = props
  const across = axis === "x"
  const box: CSSProperties = across
    ? { left: rulerSize, top: 0, width: Math.max(0, length - rulerSize), height: rulerSize }
    : { left: 0, top: rulerSize, width: rulerSize, height: Math.max(0, length - rulerSize) }
  const shift = (at: number) => at - rulerSize
  const room = Math.max(0, length - rulerSize)
  const fits = (at: number, label: string) => {
    const wide = label.length * labelGlyph
    return across ? shift(at) + 3 + wide <= room : shift(at) - 3 - wide >= 0
  }
  const spanOf = (at: number, label: string): readonly [number, number] => {
    const wide = label.length * labelGlyph
    return across ? [at + 3, at + 3 + wide] : [at - 3 - wide, at - 3]
  }
  const markSpan = (mark: Mark): readonly [number, number] => {
    const half = mark.chip === true ? chipHalf : (mark.label.length * labelGlyph) / 2
    return [mark.at - half - labelGap, mark.at + half + labelGap]
  }
  const kept = (at: number, label: string) => {
    const [start, end] = spanOf(at, label)
    return (
      fits(at, label) &&
      marks.every((mark) => {
        const [from, to] = markSpan(mark)
        return end < from || start > to
      })
    )
  }
  const point = (along: number, side: number) => (across ? `${along},${side}` : `${side},${along}`)
  const tickPath = ticks
    .map((tick) => {
      const along = crisp(shift(tick.at))
      const depth = tick.label === null ? 4 : rulerSize
      return `M${point(along, rulerSize - depth)}L${point(along, rulerSize)}`
    })
    .join("")
  return (
    <div
      data-ruler={axis}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerUp}
      onLostPointerCapture={props.onPointerUp}
      style={{
        position: "absolute",
        ...box,
        background: "var(--ruler-surface)",
        boxShadow: across ? "inset 0 -1px 0 var(--ruler-edge)" : "inset -1px 0 0 var(--ruler-edge)",
        pointerEvents: props.onPointerDown === undefined ? "none" : "auto",
        cursor: props.onPointerDown === undefined ? "default" : across ? "row-resize" : "col-resize",
        touchAction: "none",
      }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {band === null ? null : (
          <rect
            data-ruler-selection=""
            x={across ? shift(band[0]) : 0}
            y={across ? 0 : shift(band[0])}
            width={across ? Math.max(1, band[1] - band[0]) : rulerSize}
            height={across ? rulerSize : Math.max(1, band[1] - band[0])}
            fill="var(--ruler-selection)"
          />
        )}
        <path d={tickPath} fill="none" stroke="var(--ruler-tick)" strokeWidth={1} shapeRendering="crispEdges" />
        {ticks.flatMap((tick) =>
          tick.label === null || !kept(tick.at, tick.label)
            ? []
            : [
                <text
                  key={tick.at}
                  x={across ? shift(tick.at) + 3 : 0}
                  y={across ? 10 : 0}
                  fill="var(--ruler-text)"
                  style={rulerText}
                  transform={across ? undefined : `translate(10 ${String(shift(tick.at) - 3)}) rotate(-90)`}
                >
                  {tick.label}
                </text>,
              ],
        )}
        {marks.map((mark) => (
          <g key={`${mark.label} ${String(mark.at)}`}>
            {mark.chip === true ? (
              <rect
                x={across ? shift(mark.at) - chipHalf : 2}
                y={across ? 2 : shift(mark.at) - chipHalf}
                width={across ? chipHalf * 2 : rulerSize - 4}
                height={across ? rulerSize - 4 : chipHalf * 2}
                rx={2}
                fill={mark.paint}
              />
            ) : null}
            <text
              data-ruler-mark={mark.label}
              x={across ? shift(mark.at) : 0}
              y={across ? 14 : 0}
              textAnchor="middle"
              fill={mark.chip === true ? "var(--guide-label-text)" : mark.paint}
              style={{ ...rulerText, fontWeight: 600 }}
              transform={across ? undefined : `translate(14 ${String(shift(mark.at))}) rotate(-90)`}
            >
              {mark.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
