import * as doom from "@airdesign/doom"
import { useId } from "react"
import { ArrowMarker, type Arrowhead } from "./arrow-marker.js"
import { type Outline } from "./node-outline.js"

type Resolved = doom.Resolved
type Paint = doom.ResolvedPaint
type Arrow = "none" | "arrow" | "triangle" | "circle"

const heads: Readonly<Record<Exclude<Arrow, "none">, Arrowhead>> = {
  arrow: "arrow",
  triangle: "triangle",
  circle: "oval",
}

const headSize = { length: 4.5, width: 4 }

const dashes = { solid: "", dash: "3 2", dot: "0.01 2" } as const

function strokeRef(paint: Paint, id: string): string {
  if (paint.kind === "solid") return paint.color
  if (paint.kind === "gradient") return `url(#${id})`
  return "none"
}

function StrokeGradient({ paint, id }: { readonly paint: Paint; readonly id: string }) {
  if (paint.kind !== "gradient") return null
  const stops = paint.stops.map((stop, at) => <stop key={at} offset={stop.at} stopColor={stop.color} />)
  return paint.shape === "radial" ? (
    <radialGradient id={id}>{stops}</radialGradient>
  ) : (
    <linearGradient id={id} gradientTransform={`rotate(${String(paint.angle)} 0.5 0.5)`}>
      {stops}
    </linearGradient>
  )
}

export function NodeStrokes({ node, outline }: { readonly node: Resolved; readonly outline: Outline }) {
  const id = useId().replaceAll(":", "")
  const { stroke } = node
  const { w, h } = node.box
  const geometry = node.geometry
  const paints = node.strokes
  if (stroke === null || paints.length === 0) return null
  const open = geometry?.kind === "line" || geometry?.kind === "path"
  const align = open ? "center" : stroke.align
  const weight = align === "center" ? stroke.weight : stroke.weight * 2
  const dash = dashes[stroke.dash]
  const dashed =
    dash === ""
      ? {}
      : {
          strokeDasharray: dash
            .split(" ")
            .map((step) => Number(step) * stroke.weight)
            .join(" "),
        }
  const round = open || stroke.dash === "dot" ? ({ strokeLinecap: "round", strokeLinejoin: "round" } as const) : {}
  const shape = outline.fill ?? outline.stroke[0] ?? ""
  const arrows = geometry?.kind === "line" ? geometry.arrows : (["none", "none"] as const)
  const first = paints[0]
  const lineColor = first?.kind === "solid" ? first.color : "currentColor"
  const sides = stroke.sides
  const markers = {
    ...(arrows[0] === "none" ? {} : { markerStart: `url(#${id}-start)` }),
    ...(arrows[1] === "none" ? {} : { markerEnd: `url(#${id}-end)` }),
  }
  if (sides !== undefined && first?.kind === "solid")
    return (
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {sides.t ? (
          <rect x={0} y={0} width={w} height={sides.t} fill={first.color} fillOpacity={first.opacity} />
        ) : null}
        {sides.b ? (
          <rect x={0} y={h - sides.b} width={w} height={sides.b} fill={first.color} fillOpacity={first.opacity} />
        ) : null}
        {sides.l ? (
          <rect x={0} y={0} width={sides.l} height={h} fill={first.color} fillOpacity={first.opacity} />
        ) : null}
        {sides.r ? (
          <rect x={w - sides.r} y={0} width={sides.r} height={h} fill={first.color} fillOpacity={first.opacity} />
        ) : null}
      </svg>
    )
  return (
    <svg
      width={Math.max(w, 1)}
      height={Math.max(h, 1)}
      data-strokes=""
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
    >
      <defs>
        {paints.map((paint, at) => (
          <StrokeGradient key={at} paint={paint} id={`${id}-${String(at)}`} />
        ))}
        {align === "inside" ? (
          <clipPath id={`${id}-clip`}>
            <path d={shape} />
          </clipPath>
        ) : null}
        {align === "outside" ? (
          <mask
            id={`${id}-mask`}
            maskUnits="userSpaceOnUse"
            x={-stroke.weight * 2}
            y={-stroke.weight * 2}
            width={w + stroke.weight * 4}
            height={h + stroke.weight * 4}
          >
            <rect
              x={-stroke.weight * 2}
              y={-stroke.weight * 2}
              width={w + stroke.weight * 4}
              height={h + stroke.weight * 4}
              fill="white"
            />
            <path d={shape} fill="black" />
          </mask>
        ) : null}
        {arrows[0] === "none" ? null : (
          <ArrowMarker
            id={`${id}-start`}
            kind={heads[arrows[0]]}
            color={lineColor}
            weight={stroke.weight}
            size={headSize}
          />
        )}
        {arrows[1] === "none" ? null : (
          <ArrowMarker
            id={`${id}-end`}
            kind={heads[arrows[1]]}
            color={lineColor}
            weight={stroke.weight}
            size={headSize}
          />
        )}
      </defs>
      <g
        {...(align === "inside"
          ? { clipPath: `url(#${id}-clip)` }
          : align === "outside"
            ? { mask: `url(#${id}-mask)` }
            : {})}
      >
        {paints.flatMap((paint, at) =>
          outline.stroke.map((d, index) => (
            <path
              key={`${String(at)}-${String(index)}`}
              d={d}
              fill="none"
              stroke={strokeRef(paint, `${id}-${String(at)}`)}
              strokeOpacity={paint.opacity === 1 ? undefined : paint.opacity}
              strokeWidth={weight}
              {...dashed}
              {...round}
              {...markers}
            />
          )),
        )}
      </g>
    </svg>
  )
}
