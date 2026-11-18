import { FillLayers } from "./fill-layers.js"
import type { ReactNode } from "react"
import type { CanvasShadow } from "./effect-record.js"
import type { presetOutline } from "./preset-path.js"
import type { CanvasElement, PaintBox } from "./record.js"
import type { Scaled } from "./text-look.js"

export type OutlinePaths = NonNullable<ReturnType<typeof presetOutline>> | null

type Anchor = readonly [horizontal: number, vertical: number]

const anchors: Readonly<Record<string, Anchor>> = {
  tl: [0, 0],
  t: [0.5, 0],
  tr: [1, 0],
  l: [0, 0.5],
  ctr: [0.5, 0.5],
  r: [1, 0.5],
  bl: [0, 1],
  b: [0.5, 1],
  br: [1, 1],
}

const radiansPerDegree = Math.PI / 180
export const blurDeviation = 2
export const edgeDeviation = 4
const reachSpread = 3
const roundCorner = 0.16667

export const tidy = (value: number) => Math.round(value * 1000) / 1000 + 0

export function silhouetteOf(element: CanvasElement): "fill" | "line" | "both" | null {
  const filled =
    (element.fill !== null && element.outline !== "line") || element.kind === "picture" || element.layers !== undefined
  if (element.line !== null) return filled ? "both" : "line"
  return filled ? "fill" : null
}

export function softensFill(element: CanvasElement): boolean {
  return element.effects?.softEdge !== undefined && element.outline !== "line" && element.fill !== null
}

export function holdsEffectFill(element: CanvasElement): boolean {
  const effects = element.effects
  if (effects === undefined || element.outline === "line" || element.fill === null) return false
  return (
    effects.softEdge !== undefined ||
    effects.innerShadow !== undefined ||
    (effects.inners?.length ?? 0) > 0 ||
    effects.blur !== undefined
  )
}

export function castShift(direction: number, distance: number): { readonly x: number; readonly y: number } {
  const turn = direction * radiansPerDegree
  return { x: Math.cos(turn) * distance, y: Math.sin(turn) * distance }
}

function shadowOffset(shadow: CanvasShadow, rotation: number, mirrorX: boolean, mirrorY: boolean, distance: number) {
  const direction = shadow.direction * radiansPerDegree
  let x = Math.cos(direction) * distance
  let y = Math.sin(direction) * distance
  if (!shadow.rotateWithShape && rotation !== 0) {
    const turn = -rotation * radiansPerDegree
    const turnedX = x * Math.cos(turn) - y * Math.sin(turn)
    y = x * Math.sin(turn) + y * Math.cos(turn)
    x = turnedX
  }
  if (!shadow.rotateWithShape) {
    if (mirrorX) x = -x
    if (mirrorY) y = -y
  }
  return { x, y }
}

export function slideShift(shadow: CanvasShadow, box: PaintBox, distance: number) {
  const direction = shadow.direction * radiansPerDegree
  const x = Math.cos(direction) * distance
  const y = Math.sin(direction) * distance
  if (!shadow.rotateWithShape) return { x, y }
  const mirroredX = box.flipH ? -x : x
  const mirroredY = box.flipV ? -y : y
  const turn = box.rotation * radiansPerDegree
  return {
    x: mirroredX * Math.cos(turn) - mirroredY * Math.sin(turn),
    y: mirroredX * Math.sin(turn) + mirroredY * Math.cos(turn),
  }
}

export function shadowTransform(element: CanvasElement, shadow: CanvasShadow, scaled: Scaled): string {
  const box = element.box
  if (box === null) return ""
  const width = scaled(box.width)
  const height = scaled(box.height)
  const offset = shadowOffset(shadow, box.rotation, box.flipH, box.flipV, scaled(shadow.distance))
  const [horizontal, vertical] = anchors[shadow.align] ?? anchors.b!
  const anchorX = tidy(width * horizontal)
  const anchorY = tidy(height * vertical)
  const steps = [`translate(${tidy(offset.x)} ${tidy(offset.y)})`, `translate(${anchorX} ${anchorY})`]
  if (shadow.skewX !== 0) steps.push(`skewX(${shadow.skewX})`)
  if (shadow.skewY !== 0) steps.push(`skewY(${shadow.skewY})`)
  if (shadow.scaleX !== 1 || shadow.scaleY !== 1) steps.push(`scale(${shadow.scaleX} ${shadow.scaleY})`)
  steps.push(`translate(${tidy(-anchorX)} ${tidy(-anchorY)})`)
  return steps.join(" ")
}

function shadowReach(shadow: CanvasShadow, scaled: Scaled, size: number): number {
  const stretch =
    Math.max(1, Math.abs(shadow.scaleX), Math.abs(shadow.scaleY)) +
    Math.tan(Math.min(Math.abs(shadow.skewX), 89) * radiansPerDegree) +
    Math.tan(Math.min(Math.abs(shadow.skewY), 89) * radiansPerDegree)
  return scaled(shadow.distance) + scaled(shadow.blur) * reachSpread + size * stretch
}

function reachOf(element: CanvasElement, scaled: Scaled): number {
  const box = element.box
  if (box === null) return 0
  const size = Math.max(scaled(box.width), scaled(box.height))
  const glow = scaled(element.effects?.glow?.radius ?? 0) * reachSpread
  const shadows = [element.effects?.shadow, ...(element.effects?.drops ?? [])].filter(
    (shadow): shadow is CanvasShadow => shadow !== undefined,
  )
  return shadows.reduce((reach, shadow) => Math.max(reach, shadowReach(shadow, scaled, size)), glow)
}

type SilhouetteProps = {
  readonly element: CanvasElement
  readonly paths: OutlinePaths
  readonly width: number
  readonly height: number
  readonly fill: string
  readonly stroke: string
  readonly strokeWidth: number
  readonly extra?: Readonly<Record<string, string>>
}

function inked(element: CanvasElement, ink: string) {
  const kind = silhouetteOf(element)
  return {
    fill: kind === "line" || kind === null ? "none" : ink,
    stroke: element.line === null ? "none" : ink,
  }
}

function Silhouette(props: SilhouetteProps) {
  const { element, extra, height, paths, width } = props
  const style = { strokeWidth: props.strokeWidth, ...extra } as const
  if (paths !== null)
    return paths.flatMap((path, index) =>
      path.fill || path.stroke
        ? [
            <path
              key={index}
              d={path.d}
              {...style}
              fill={path.fill ? props.fill : "none"}
              stroke={path.stroke ? props.stroke : "none"}
            />,
          ]
        : [],
    )
  const own = { ...style, fill: props.fill, stroke: props.stroke }
  if (element.outline === "line") return <line x1={0} y1={0} x2={width} y2={height} {...own} fill="none" />
  if (element.outline === "ellipse")
    return <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...own} />
  return (
    <rect
      width={width}
      height={height}
      {...(element.outline === "round" ? { rx: Math.min(width, height) * roundCorner } : {})}
      {...own}
    />
  )
}

type EffectProps = {
  readonly id: string
  readonly element: CanvasElement
  readonly paths: OutlinePaths
  readonly scaled: Scaled
  readonly width: number
  readonly height: number
  readonly weight: number
}

function colorFilter(id: string, area: Area, color: string, shape: ReactNode) {
  return (
    <filter key={id} id={id} filterUnits="userSpaceOnUse" {...area}>
      {shape}
      <feFlood floodColor={color} result="color" />
      <feComposite in="color" in2="shape" operator="in" />
    </filter>
  )
}

type Area = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const areaAround = (width: number, height: number, margin: number): Area => ({
  x: -margin,
  y: -margin,
  width: Math.max(width, 1) + margin * 2,
  height: Math.max(height, 1) + margin * 2,
})

export function EffectDefs(props: EffectProps) {
  const { element, height, id, scaled, width } = props
  const effects = element.effects
  if (effects === undefined) return null
  const outside = silhouetteOf(element) === null ? null : reachOf(element, scaled)
  const shadow = effects.shadow
  const glow = effects.glow
  const soft = effects.softEdge
  const drops = effects.drops ?? []
  const inners = effects.inners ?? []
  return (
    <>
      {outside === null || (shadow === undefined && glow === undefined && drops.length === 0) ? null : (
        <mask id={`${id}-outside`} maskUnits="userSpaceOnUse" {...areaAround(width, height, outside)}>
          <rect {...areaAround(width, height, outside)} fill="white" />
          <Silhouette
            element={element}
            paths={props.paths}
            width={width}
            height={height}
            {...inked(element, "black")}
            strokeWidth={props.weight}
          />
        </mask>
      )}
      {outside === null || shadow === undefined
        ? null
        : colorFilter(
            `${id}-shadow`,
            areaAround(width, height, scaled(shadow.blur) * reachSpread),
            shadow.color,
            <feGaussianBlur in="SourceAlpha" stdDeviation={scaled(shadow.blur) / blurDeviation} result="shape" />,
          )}
      {outside === null || glow === undefined
        ? null
        : colorFilter(
            `${id}-glow`,
            areaAround(width, height, scaled(glow.radius) * reachSpread),
            glow.color,
            <>
              <feMorphology in="SourceAlpha" operator="dilate" radius={scaled(glow.radius) / 2} result="grown" />
              <feGaussianBlur in="grown" stdDeviation={scaled(glow.radius) / edgeDeviation} result="shape" />
            </>,
          )}
      {soft === undefined ? null : (
        <filter id={`${id}-soft`} filterUnits="userSpaceOnUse" {...areaAround(width, height, scaled(soft.radius))}>
          <feMorphology in="SourceAlpha" operator="erode" radius={scaled(soft.radius) / 2} result="worn" />
          <feGaussianBlur in="worn" stdDeviation={scaled(soft.radius) / edgeDeviation} result="shape" />
          <feComposite in="SourceGraphic" in2="shape" operator="in" />
        </filter>
      )}
      {effects.innerShadow === undefined ? null : (
        <filter
          id={`${id}-inner`}
          filterUnits="userSpaceOnUse"
          {...areaAround(width, height, scaled(effects.innerShadow.blur) * reachSpread)}
        >
          <feFlood floodColor={effects.innerShadow.color} result="flood" />
          <feComposite in="flood" in2="SourceAlpha" operator="out" result="outside" />
          <feGaussianBlur in="outside" stdDeviation={scaled(effects.innerShadow.blur) / blurDeviation} result="soft" />
          <feOffset
            in="soft"
            dx={tidy(castShift(effects.innerShadow.direction, scaled(effects.innerShadow.distance)).x)}
            dy={tidy(castShift(effects.innerShadow.direction, scaled(effects.innerShadow.distance)).y)}
            result="cast"
          />
          <feComposite in="cast" in2="SourceAlpha" operator="in" />
        </filter>
      )}
      {drops.map((drop, index) =>
        colorFilter(
          `${id}-drop-${index}`,
          areaAround(width, height, scaled(drop.blur) * reachSpread),
          drop.color,
          <feGaussianBlur in="SourceAlpha" stdDeviation={scaled(drop.blur) / blurDeviation} result="shape" />,
        ),
      )}
      {inners.map((inner, index) => (
        <filter
          key={`${id}-inner-${index}`}
          id={`${id}-inner-${index}`}
          filterUnits="userSpaceOnUse"
          {...areaAround(width, height, scaled(inner.blur) * reachSpread)}
        >
          <feFlood floodColor={inner.color} result="flood" />
          <feComposite in="flood" in2="SourceAlpha" operator="out" result="outside" />
          <feGaussianBlur in="outside" stdDeviation={scaled(inner.blur) / blurDeviation} result="soft" />
          <feOffset
            in="soft"
            dx={tidy(castShift(inner.direction, scaled(inner.distance)).x)}
            dy={tidy(castShift(inner.direction, scaled(inner.distance)).y)}
            result="cast"
          />
          <feComposite in="cast" in2="SourceAlpha" operator="in" />
        </filter>
      ))}
      {effects.blur === undefined ? null : (
        <filter
          id={`${id}-blur`}
          filterUnits="userSpaceOnUse"
          {...areaAround(width, height, scaled(effects.blur.radius) * reachSpread)}
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={scaled(effects.blur.radius) / blurDeviation} />
        </filter>
      )}
    </>
  )
}

export function EffectLayers(props: EffectProps) {
  const { element, height, id, width } = props
  const effects = element.effects
  if (effects === undefined || silhouetteOf(element) === null) return null
  const { glow, shadow } = effects
  const drops = effects.drops ?? []
  if (shadow === undefined && glow === undefined && drops.length === 0) return null
  const silhouette = (
    <Silhouette
      element={element}
      paths={props.paths}
      width={width}
      height={height}
      {...inked(element, "black")}
      strokeWidth={props.weight}
    />
  )
  return (
    <g mask={`url(#${id}-outside)`}>
      {shadow === undefined ? null : (
        <g data-effect-shadow transform={shadowTransform(element, shadow, props.scaled)}>
          <g filter={`url(#${id}-shadow)`}>{silhouette}</g>
        </g>
      )}
      {glow === undefined ? null : (
        <g data-effect-glow filter={`url(#${id}-glow)`}>
          {silhouette}
        </g>
      )}
      {drops.map((drop, index) => (
        <g key={`${id}-drop-${index}`} data-effect-drop transform={shadowTransform(element, drop, props.scaled)}>
          <g filter={`url(#${id}-drop-${index})`}>{silhouette}</g>
        </g>
      ))}
    </g>
  )
}

export function SoftFill(props: EffectProps & { readonly paint: string | null }) {
  const { element, height, id, paint, width } = props
  if (!softensFill(element) || props.paths !== null) return null
  if (paint === null)
    return (
      <g {...softAttributes(id)}>
        <CssFill element={element} width={width} height={height} />
      </g>
    )
  return (
    <Silhouette
      element={element}
      paths={null}
      width={width}
      height={height}
      fill={paint}
      stroke="none"
      strokeWidth={0}
      extra={softAttributes(id)}
    />
  )
}

export function CssFill(props: {
  readonly element: CanvasElement
  readonly width: number
  readonly height: number
  readonly clip?: string
}) {
  const { element, height, width } = props
  const radius =
    props.clip !== undefined
      ? {}
      : element.outline === "ellipse"
        ? { borderRadius: "50%" }
        : element.outline === "round"
          ? { borderRadius: Math.min(width, height) * roundCorner }
          : {}
  return (
    <foreignObject
      x={0}
      y={0}
      width={Math.max(width, 1)}
      height={Math.max(height, 1)}
      overflow="visible"
      {...(props.clip === undefined ? {} : { clipPath: props.clip })}
    >
      {element.layers === undefined ? (
        <div style={{ width: "100%", height: "100%", background: element.fill ?? "none", ...radius }} />
      ) : (
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...radius }}>
          <FillLayers
            element={element}
            scaled={(emu) => (element.box === null || element.box.width <= 0 ? 0 : (emu * width) / element.box.width)}
            unshown={false}
          />
        </div>
      )}
    </foreignObject>
  )
}

export const softAttributes = (id: string) => ({ "data-effect-soft": "", filter: `url(#${id}-soft)` })

export function InnerShadow(props: EffectProps) {
  const { element, height, id, width } = props
  const inner = element.effects?.innerShadow
  const extras = element.effects?.inners ?? []
  if ((inner === undefined && extras.length === 0) || silhouetteOf(element) === null) return null
  const silhouette = (
    <Silhouette
      element={element}
      paths={props.paths}
      width={width}
      height={height}
      {...inked(element, "black")}
      strokeWidth={props.weight}
    />
  )
  return (
    <>
      {inner === undefined ? null : (
        <g data-effect-inner filter={`url(#${id}-inner)`}>
          {silhouette}
        </g>
      )}
      {extras.map((inner, index) => (
        <g key={`${id}-inner-${index}-${inner.color}`} data-effect-inner filter={`url(#${id}-inner-${index})`}>
          {silhouette}
        </g>
      ))}
    </>
  )
}

export function EffectFill(props: EffectProps & { readonly paint: string | null }) {
  const { element, height, paint, width } = props
  if (!holdsEffectFill(element) || softensFill(element) || props.paths !== null) return null
  if (paint === null) return <CssFill element={element} width={width} height={height} />
  return (
    <Silhouette
      element={element}
      paths={null}
      width={width}
      height={height}
      fill={paint}
      stroke="none"
      strokeWidth={0}
    />
  )
}

export function paintsEffects(element: CanvasElement): boolean {
  const effects = element.effects
  if (effects === undefined) return false
  return (
    softensFill(element) ||
    effects.innerShadow !== undefined ||
    (effects.inners?.length ?? 0) > 0 ||
    effects.blur !== undefined ||
    ((effects.shadow !== undefined || effects.glow !== undefined || (effects.drops?.length ?? 0) > 0) &&
      silhouetteOf(element) !== null)
  )
}
