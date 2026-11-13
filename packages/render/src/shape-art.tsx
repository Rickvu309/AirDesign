import { useId } from "react"
import { presetOutline } from "./preset-path.js"
import type { CanvasElement, CanvasLine } from "./record.js"
import type { Scaled } from "./text-look.js"
import { ShapeGradient } from "./shape-gradient.js"

type Arrowhead = NonNullable<CanvasLine["head"]>

const arrowPaths: Readonly<Record<Exclude<Arrowhead, "oval">, string>> = {
  triangle: "M0 0L10 5L0 10Z",
  stealth: "M0 0L10 5L0 10L3 5Z",
  diamond: "M0 5L5 0L10 5L5 10Z",
  arrow: "M0 0L10 5L0 10",
}

function ArrowMarker(props: {
  readonly id: string
  readonly kind: Arrowhead
  readonly color: string
  readonly weight: number
}) {
  const { id, kind, color, weight } = props
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      markerWidth={3 * weight}
      markerHeight={3 * weight}
      refX={kind === "oval" || kind === "diamond" ? 5 : 10}
      refY={5}
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
      overflow="visible"
    >
      {kind === "oval" ? (
        <ellipse cx={5} cy={5} rx={5} ry={5} fill={color} />
      ) : (
        <path
          d={arrowPaths[kind]}
          fill={kind === "arrow" ? "none" : color}
          stroke={kind === "arrow" ? color : "none"}
          strokeWidth={1}
        />
      )}
    </marker>
  )
}

const grabWidth = 10

function GrabBand(props: { readonly d: string; readonly weight: number }) {
  return (
    <path
      data-canvas-grab
      d={props.d}
      fill="none"
      stroke="transparent"
      strokeWidth={Math.max(props.weight, grabWidth)}
      style={{ pointerEvents: "stroke", cursor: "move" }}
    />
  )
}

export function shapePaths(element: CanvasElement, scaled: Scaled) {
  if (element.box === null || element.geometry === undefined) return null
  return presetOutline(
    element.geometry.preset,
    scaled(element.box.width),
    scaled(element.box.height),
    element.geometry.adjusts,
  )
}

export function ShapeArt(props: { readonly element: CanvasElement; readonly scaled: Scaled; readonly grab?: boolean }) {
  const id = useId().replaceAll(":", "")
  const { element, scaled } = props
  if (element.box === null) return null
  const paths = shapePaths(element, scaled)
  const line = element.line
  if (paths === null && line === null) return null
  const width = scaled(element.box.width)
  const height = scaled(element.box.height)
  const weight = scaled(line?.width ?? 0)
  const gradient = element.geometry?.gradient
  const cssFill = element.fill?.includes("gradient(") === true || element.fill?.includes("url(") === true
  const fill = gradient !== undefined ? `url(#${id}-gradient)` : cssFill ? null : element.fill
  const stroke = {
    fill: "none",
    stroke: line?.color ?? "none",
    strokeWidth: weight,
    ...(props.grab === true ? { style: { pointerEvents: "visibleStroke", cursor: "move" } as const } : {}),
    ...(line?.dash == null ? {} : { strokeDasharray: line.dash.map((step) => step * weight).join(" ") }),
    ...(line?.head === undefined ? {} : { markerStart: `url(#${id}-head)` }),
    ...(line?.tail === undefined ? {} : { markerEnd: `url(#${id}-tail)` }),
  }
  const open = paths === null ? element.outline === "line" : paths.every((path) => !path.fill)
  const bands =
    props.grab !== true || !open || line === null
      ? []
      : (paths?.map((path) => path.d) ?? [`M0 0L${String(width)} ${String(height)}`])
  return (
    <svg
      data-canvas-line
      data-canvas-path={paths === null ? undefined : ""}
      width={Math.max(width, 1)}
      height={Math.max(height, 1)}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        {gradient === undefined ? null : (
          <ShapeGradient id={`${id}-gradient`} gradient={gradient} width={width} height={height} />
        )}
        {line?.head === undefined ? null : (
          <ArrowMarker id={`${id}-head`} kind={line.head} color={line.color} weight={weight} />
        )}
        {line?.tail === undefined ? null : (
          <ArrowMarker id={`${id}-tail`} kind={line.tail} color={line.color} weight={weight} />
        )}
        {paths?.map((path, index) =>
          path.fill ? (
            <clipPath key={index} id={`${id}-fill-${index}`}>
              <path d={path.d} />
            </clipPath>
          ) : null,
        )}
      </defs>
      {paths === null
        ? null
        : paths.map((path, index) => (
            <g key={index}>
              {path.fill && fill !== null && element.outline !== "line" ? <path d={path.d} fill={fill} /> : null}
              {path.fill && fill === null && element.fill !== null && element.outline !== "line" ? (
                <foreignObject
                  x={0}
                  y={0}
                  width={Math.max(width, 1)}
                  height={Math.max(height, 1)}
                  overflow="visible"
                  clipPath={`url(#${id}-fill-${index})`}
                >
                  <div style={{ width: "100%", height: "100%", background: element.fill }} />
                </foreignObject>
              ) : null}
              {path.stroke ? <path d={path.d} {...stroke} /> : null}
            </g>
          ))}
      {paths !== null ? null : element.outline === "line" ? (
        <line x1={0} y1={0} x2={width} y2={height} {...stroke} />
      ) : element.outline === "ellipse" ? (
        <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...stroke} />
      ) : (
        <rect
          width={width}
          height={height}
          {...(element.outline === "round" ? { rx: Math.min(width, height) * 0.16667 } : {})}
          {...stroke}
        />
      )}
      {bands.map((d, index) => (
        <GrabBand key={index} d={d} weight={weight} />
      ))}
    </svg>
  )
}
