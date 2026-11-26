import { useId } from "react"
import * as doom from "@airdesign/doom"
import { cropShown, imageArea, type CropGrip } from "./crop-drag"
import { ScreenSized } from "./screen-sized"
import { apply, type Placed, type Point } from "./slide-geometry"
import { resizeCursor, type ResizeGrip } from "./transform-math"

export type CropTarget = {
  readonly node: doom.NodeId
  readonly natural: { readonly width: number; readonly height: number } | null
}

const edge = "var(--primary-strong)"
const bar = 22
const thick = 4
const leg = 14
const reach = 12

const resizeGrip = {
  "crop-n": "top",
  "crop-s": "bottom",
  "crop-e": "right",
  "crop-w": "left",
  "crop-nw": "top-left",
  "crop-ne": "top-right",
  "crop-se": "bottom-right",
  "crop-sw": "bottom-left",
} as const satisfies Record<Exclude<CropGrip, "crop-move">, ResizeGrip>

export function cropCursor(grip: Exclude<CropGrip, "crop-move">, rotation: number): string {
  return resizeCursor(resizeGrip[grip], rotation)
}

export function cropGripReach(screenWidth: number, screenHeight: number): number {
  const room = Math.min(screenWidth, screenHeight) / 2 - 1
  if (!(room >= 4)) return 0
  return Math.min(reach, room)
}

const corners = [
  { grip: "crop-nw", x: 0, y: 0 },
  { grip: "crop-ne", x: 1, y: 0 },
  { grip: "crop-se", x: 1, y: 1 },
  { grip: "crop-sw", x: 0, y: 1 },
] as const
const sides = [
  { grip: "crop-n", x: 0.5, y: 0 },
  { grip: "crop-e", x: 1, y: 0.5 },
  { grip: "crop-s", x: 0.5, y: 1 },
  { grip: "crop-w", x: 0, y: 0.5 },
] as const

function cornerPath(x: number, y: number): string {
  return `M${String((x === 0 ? 1 : -1) * leg)},0H0V${String((y === 0 ? 1 : -1) * leg)}`
}

export function CropHandles({
  placed,
  view,
  target,
  url,
  scale,
}: {
  readonly placed: Placed
  readonly view: doom.Doom
  readonly target: CropTarget
  readonly url: string | undefined
  readonly scale: number
}) {
  const clip = useId()
  const shown = cropShown(view, target.node, target.natural)
  const box = doom.propOf(view.nodes.get(target.node), "box")
  if (shown === null || box === undefined) return null
  const { w, h } = box
  const [a, b, c, d, e, f] = placed.matrix
  const image = imageArea(box, shown)
  const mirror = `translate(${box.flipH ? String(w) : "0"} ${box.flipV ? String(h) : "0"}) scale(${box.flipH ? "-1" : "1"} ${box.flipV ? "-1" : "1"})`
  const spot = (x: number, y: number): Point => {
    const at = apply(placed.matrix, { x: x * w, y: y * h })
    return { x: at.x * scale, y: at.y * scale }
  }
  const gripReach = cropGripReach(Math.abs(w * scale), Math.abs(h * scale))
  const hitShort = Math.min(reach, gripReach * 2)
  return (
    <g data-crop-handles="">
      {url === undefined ? null : (
        <g transform={`matrix(${[a, b, c, d, e, f].map((value) => String(value * scale)).join(" ")})`}>
          <clipPath id={clip}>
            <path clipRule="evenodd" d={`M-100000,-100000H100000V100000H-100000ZM0,0V${String(h)}H${String(w)}V0Z`} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <g transform={mirror}>
              <image
                data-grip="crop-move"
                href={url}
                x={image.x}
                y={image.y}
                width={image.width}
                height={image.height}
                preserveAspectRatio="none"
                opacity={0.45}
                style={{ pointerEvents: "all", cursor: "move" }}
              />
            </g>
          </g>
          <rect
            data-grip="crop-move"
            width={w}
            height={h}
            fill="transparent"
            style={{ pointerEvents: "all", cursor: "move" }}
          />
        </g>
      )}
      {sides.map(({ grip, x, y }) => {
        const at = spot(x, y)
        const across = grip === "crop-n" || grip === "crop-s"
        const long = across ? bar : thick
        const short = across ? thick : bar
        const hitLong = Math.max(long, gripReach)
        const hitW = across ? hitLong : hitShort
        const hitH = across ? hitShort : hitLong
        return (
          <ScreenSized key={grip} at={at} turn={placed.rotation}>
            {gripReach === 0 ? null : (
              <rect
                data-grip={grip}
                x={-hitW / 2}
                y={-hitH / 2}
                width={hitW}
                height={hitH}
                fill="transparent"
                style={{ pointerEvents: "all", cursor: cropCursor(grip, placed.rotation) }}
              />
            )}
            <rect
              data-crop-grip={grip}
              x={-long / 2}
              y={-short / 2}
              width={long}
              height={short}
              rx={1}
              fill="white"
              stroke={edge}
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
          </ScreenSized>
        )
      })}
      {corners.map(({ grip, x, y }) => {
        const at = spot(x, y)
        return (
          <ScreenSized key={grip} at={at} turn={placed.rotation}>
            {gripReach === 0 ? null : (
              <circle
                data-grip={grip}
                r={gripReach}
                fill="transparent"
                style={{ pointerEvents: "all", cursor: cropCursor(grip, placed.rotation) }}
              />
            )}
            <path
              data-crop-grip={grip}
              d={cornerPath(x, y)}
              fill="none"
              stroke="white"
              strokeWidth={thick + 2}
              strokeLinecap="square"
              style={{ pointerEvents: "none" }}
            />
            <path
              d={cornerPath(x, y)}
              fill="none"
              stroke={edge}
              strokeWidth={thick}
              strokeLinecap="square"
              style={{ pointerEvents: "none" }}
            />
          </ScreenSized>
        )
      })}
    </g>
  )
}
