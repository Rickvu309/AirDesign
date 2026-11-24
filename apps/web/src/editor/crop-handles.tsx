import { useId } from "react"
import * as doom from "@airdesign/doom"
import { cropShown, imageArea, type CropGrip } from "./crop-drag"
import { apply, type Placed, type Point } from "./slide-geometry"

export type CropTarget = {
  readonly node: doom.NodeId
  readonly natural: { readonly width: number; readonly height: number } | null
}

const edge = "var(--primary-strong)"
const bar = 22
const thick = 4
const leg = 14
const reach = 12

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

const cursors: Readonly<Record<Exclude<CropGrip, "crop-move">, string>> = {
  "crop-n": "ns-resize",
  "crop-s": "ns-resize",
  "crop-e": "ew-resize",
  "crop-w": "ew-resize",
  "crop-nw": "nwse-resize",
  "crop-se": "nwse-resize",
  "crop-ne": "nesw-resize",
  "crop-sw": "nesw-resize",
}

function cornerPath(at: Point, x: number, y: number): string {
  const inward = { x: x === 0 ? 1 : -1, y: y === 0 ? 1 : -1 }
  return `M${String(at.x + inward.x * leg)},${String(at.y)}H${String(at.x)}V${String(at.y + inward.y * leg)}`
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
  const turn = `rotate(${String(placed.rotation)}`
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
        return (
          <g key={grip} transform={`${turn} ${String(at.x)} ${String(at.y)})`}>
            <rect
              data-grip={grip}
              x={at.x - Math.max(long, reach) / 2}
              y={at.y - Math.max(short, reach) / 2}
              width={Math.max(long, reach)}
              height={Math.max(short, reach)}
              fill="transparent"
              style={{ pointerEvents: "all", cursor: cursors[grip] }}
            />
            <rect
              data-crop-grip={grip}
              x={at.x - long / 2}
              y={at.y - short / 2}
              width={long}
              height={short}
              rx={1}
              fill="white"
              stroke={edge}
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
          </g>
        )
      })}
      {corners.map(({ grip, x, y }) => {
        const at = spot(x, y)
        return (
          <g key={grip} transform={`${turn} ${String(at.x)} ${String(at.y)})`}>
            <circle
              data-grip={grip}
              cx={at.x}
              cy={at.y}
              r={reach}
              fill="transparent"
              style={{ pointerEvents: "all", cursor: cursors[grip] }}
            />
            <path
              data-crop-grip={grip}
              d={cornerPath(at, x, y)}
              fill="none"
              stroke="white"
              strokeWidth={thick + 2}
              strokeLinecap="square"
              style={{ pointerEvents: "none" }}
            />
            <path
              d={cornerPath(at, x, y)}
              fill="none"
              stroke={edge}
              strokeWidth={thick}
              strokeLinecap="square"
              style={{ pointerEvents: "none" }}
            />
          </g>
        )
      })}
    </g>
  )
}
