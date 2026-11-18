import { useId } from "react"
import { presetOutline } from "./preset-path.js"
import type { CanvasElement, CanvasLine } from "./record.js"
import type { CanvasArrowSize } from "./line-record.js"
import type { Scaled } from "./text-look.js"
import {
  CssFill,
  EffectDefs,
  EffectFill,
  EffectLayers,
  holdsEffectFill,
  InnerShadow,
  paintsEffects,
  SoftFill,
  softAttributes,
  softensFill,
} from "./effect-art.js"
import { ShapeGradient, sidesGradient } from "./shape-gradient.js"

type Arrowhead = NonNullable<CanvasLine["head"]>

const arrowPaths: Readonly<Record<Exclude<Arrowhead, "oval">, string>> = {
  triangle: "M0 0L10 5L0 10Z",
  stealth: "M0 0L10 5L0 10L3 5Z",
  diamond: "M0 5L5 0L10 5L5 10Z",
  arrow: "M0 0L10 5L0 10",
}

const defaultArrowScale = 3

type Compound = NonNullable<CanvasLine["compound"]>
type Band = readonly [from: number, to: number]

const compoundBands: Readonly<Record<Compound, readonly Band[]>> = {
  dbl: [
    [-1 / 2, -1 / 6],
    [1 / 6, 1 / 2],
  ],
  tri: [
    [-3 / 6, -2 / 6],
    [-1 / 6, 1 / 6],
    [2 / 6, 3 / 6],
  ],
  thickThin: [
    [-1 / 2, 0],
    [1 / 4, 1 / 2],
  ],
  thinThick: [
    [-1 / 2, -1 / 4],
    [0, 1 / 2],
  ],
}

const compoundMaskLayers: Readonly<Record<Compound, readonly (readonly [width: number, color: string])[]>> = {
  dbl: [
    [1, "white"],
    [1 / 3, "black"],
  ],
  tri: [
    [1, "white"],
    [4 / 6, "black"],
    [2 / 6, "white"],
  ],
  thickThin: [
    [1, "white"],
    [1 / 3, "black"],
  ],
  thinThick: [
    [1, "white"],
    [1 / 3, "black"],
  ],
}

function ArrowMarker(props: {
  readonly id: string
  readonly kind: Arrowhead
  readonly color: string
  readonly weight: number
  readonly size: CanvasArrowSize | undefined
}) {
  const { id, kind, color, weight, size } = props
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      preserveAspectRatio="none"
      markerWidth={(size?.length ?? defaultArrowScale) * weight}
      markerHeight={(size?.width ?? defaultArrowScale) * weight}
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

export function paintsFillAsSvg(element: CanvasElement, scaled: Scaled) {
  return (
    shapePaths(element, scaled) !== null ||
    (element.outline !== "line" && sidesGradient(element.geometry?.gradient)) ||
    holdsEffectFill(element)
  )
}

export function ShapeArt(props: { readonly element: CanvasElement; readonly scaled: Scaled; readonly grab?: boolean }) {
  const id = useId().replaceAll(":", "")
  const { element, scaled } = props
  if (element.box === null) return null
  const paths = shapePaths(element, scaled)
  const line = element.line
  const sidesFill = paths === null && element.outline !== "line" && sidesGradient(element.geometry?.gradient)
  if (paths === null && line === null && !sidesFill && !paintsEffects(element)) return null
  const width = scaled(element.box.width)
  const height = scaled(element.box.height)
  const weight = scaled(line?.width ?? 0)
  const gradient = element.geometry?.gradient
  const cssFill = element.fill?.includes("gradient(") === true || element.fill?.includes("url(") === true
  const fill = gradient !== undefined ? `url(#${id}-gradient)` : cssFill ? null : element.fill
  const compound = line?.compound
  const translated = compound !== undefined && paths === null && element.outline === "line"
  const masked = compound !== undefined && !translated
  const maskId = `${id}-compound`
  const effect = { id, element, paths, scaled, width, height, weight }
  const softened = softensFill(element)
  const soft = softened ? softAttributes(id) : {}
  const shape = {
    ...(line?.cap === undefined ? {} : { strokeLinecap: line.cap }),
    ...(line?.join === undefined ? {} : { strokeLinejoin: line.join.kind }),
    ...(line?.join?.limit === undefined ? {} : { strokeMiterlimit: line.join.limit }),
  }
  const edge = {
    fill: sidesFill && !softened ? (fill ?? "none") : "none",
    stroke: line?.color ?? "none",
    strokeWidth: weight,
    ...(props.grab === true ? { style: { pointerEvents: "visibleStroke", cursor: "move" } as const } : {}),
    ...(line?.dash == null ? {} : { strokeDasharray: line.dash.map((step) => step * weight).join(" ") }),
    ...shape,
  }
  const markers = {
    ...(line?.head === undefined ? {} : { markerStart: `url(#${id}-head)` }),
    ...(line?.tail === undefined ? {} : { markerEnd: `url(#${id}-tail)` }),
  }
  const stroke = {
    ...edge,
    ...(compound === undefined ? markers : {}),
    ...(masked ? { mask: `url(#${maskId})` } : {}),
  }
  const strokeGeometry = (style: object) =>
    paths === null
      ? [
          element.outline === "line" ? (
            <line key={0} x1={0} y1={0} x2={width} y2={height} {...style} />
          ) : element.outline === "ellipse" ? (
            <ellipse key={0} cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...style} />
          ) : (
            <rect
              key={0}
              width={width}
              height={height}
              {...(element.outline === "round" ? { rx: Math.min(width, height) * 0.16667 } : {})}
              {...style}
            />
          ),
        ]
      : paths.flatMap((path, index) => (path.stroke ? [<path key={index} d={path.d} {...style} />] : []))
  const markerCopy =
    compound === undefined || Object.keys(markers).length === 0
      ? null
      : strokeGeometry({ fill: "none", stroke: "transparent", strokeWidth: weight, ...markers })
  const length = Math.hypot(width, height)
  const normal = length === 0 ? { x: 0, y: 1 } : { x: -height / length, y: width / length }
  const open = paths === null ? element.outline === "line" : paths.every((path) => !path.fill)
  const bands =
    props.grab !== true || !open || line === null
      ? []
      : (paths?.map((path) => path.d) ?? [`M0 0L${String(width)} ${String(height)}`])
  const layerBlur = element.effects?.blur !== undefined
  const fills =
    paths === null
      ? null
      : paths.map((path, index) =>
          path.fill && fill !== null && element.outline !== "line" ? (
            <path key={index} d={path.d} fill={fill} {...soft} />
          ) : path.fill && fill === null && element.fill !== null && element.outline !== "line" ? (
            <g key={index} {...soft}>
              <CssFill element={element} width={width} height={height} clip={`url(#${id}-fill-${index})`} />
            </g>
          ) : null,
        )
  const strokes =
    paths === null
      ? null
      : paths.map((path, index) => (path.stroke ? <path key={index} d={path.d} {...stroke} /> : null))
  const frame =
    paths !== null ? null : translated ? (
      compoundBands[compound].map(([from, to], index) => {
        const offset = ((from + to) / 2) * weight
        return (
          <line
            key={index}
            x1={normal.x * offset}
            y1={normal.y * offset}
            x2={width + normal.x * offset}
            y2={height + normal.y * offset}
            {...edge}
            strokeWidth={(to - from) * weight}
          />
        )
      })
    ) : element.outline === "line" ? (
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
    )
  const art = (
    <>
      <EffectLayers {...effect} />
      {fills === null ? null : <g>{fills}</g>}
      <SoftFill {...effect} paint={fill} />
      <EffectFill {...effect} paint={fill} />
      <InnerShadow {...effect} />
      {strokes === null ? null : <g>{strokes}</g>}
      {frame}
      {markerCopy}
      {bands.map((d, index) => (
        <GrabBand key={index} d={d} weight={weight} />
      ))}
    </>
  )
  return (
    <svg
      data-canvas-line
      data-canvas-path={paths === null ? undefined : ""}
      data-effect-blur={layerBlur ? "" : undefined}
      width={Math.max(width, 1)}
      height={Math.max(height, 1)}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        <EffectDefs {...effect} />
        {gradient === undefined ? null : (
          <ShapeGradient id={`${id}-gradient`} gradient={gradient} width={width} height={height} />
        )}
        {line?.head === undefined ? null : (
          <ArrowMarker id={`${id}-head`} kind={line.head} color={line.color} weight={weight} size={line.headSize} />
        )}
        {line?.tail === undefined ? null : (
          <ArrowMarker id={`${id}-tail`} kind={line.tail} color={line.color} weight={weight} size={line.tailSize} />
        )}
        {masked ? (
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={-4 * weight}
            y={-4 * weight}
            width={Math.max(width, 1) + 8 * weight}
            height={Math.max(height, 1) + 8 * weight}
          >
            {compoundMaskLayers[compound].map(([share, color], index) => (
              <g key={index}>
                {strokeGeometry({ fill: "none", stroke: color, strokeWidth: share * weight, ...shape })}
              </g>
            ))}
          </mask>
        ) : null}
        {paths?.map((path, index) =>
          path.fill ? (
            <clipPath key={index} id={`${id}-fill-${index}`}>
              <path d={path.d} />
            </clipPath>
          ) : null,
        )}
      </defs>
      {layerBlur ? <g filter={`url(#${id}-blur)`}>{art}</g> : art}
    </svg>
  )
}
