import { paintKind, type PaintElement, type PaintLine } from "@airdesign/pptx"
import type { CanvasLine, CanvasOutline } from "@airdesign/render"
import { cssColor } from "@/paint-css"

const outlines = new Map<string, CanvasOutline>([
  ["ellipse", "ellipse"],
  ["roundRect", "round"],
  ["line", "line"],
  ["straightConnector1", "line"],
])
const dashes = new Map<string, readonly number[]>([
  ["dot", [1, 3]],
  ["sysDot", [1, 1]],
  ["sysDash", [3, 1]],
  ["dash", [4, 3]],
  ["dashDot", [4, 3, 1, 3]],
  ["lgDash", [8, 3]],
  ["lgDashDot", [8, 3, 1, 3]],
  ["lgDashDotDot", [8, 3, 1, 3, 1, 3]],
  ["sysDashDot", [3, 1, 1, 1]],
  ["sysDashDotDot", [3, 1, 1, 1, 1, 1]],
])
const ends = new Map<string, NonNullable<CanvasLine["head"]>>([
  ["triangle", "triangle"],
  ["stealth", "stealth"],
  ["diamond", "diamond"],
  ["oval", "oval"],
  ["arrow", "arrow"],
])

export function outlineOf(row: PaintElement): CanvasOutline {
  if (paintKind(row.kind) === "connector") return "line"
  return outlines.get(row.geometry ?? "") ?? "box"
}

function lineColor(fill: PaintLine["fill"]): string | null {
  if (fill.type === "solid") return cssColor(fill.color)
  if (fill.type === "pattern") return cssColor(fill.foreground)
  if (fill.type !== "gradient") return null
  const first = fill.stops[0]
  return first === undefined ? null : cssColor(first.color)
}

export function canvasLine(line: PaintLine | null): CanvasLine | null {
  if (line === null) return null
  const color = lineColor(line.fill)
  const head = ends.get(line.head ?? "")
  const tail = ends.get(line.tail ?? "")
  return color === null
    ? null
    : {
        color,
        width: line.width,
        dash: dashes.get(line.dash ?? "") ?? null,
        ...(head === undefined ? {} : { head }),
        ...(tail === undefined ? {} : { tail }),
      }
}

export function geometryOf(row: PaintElement) {
  if (row.geometry === null) return undefined
  const fill = row.fill
  const gradient =
    fill?.type !== "gradient" || row.image !== null
      ? undefined
      : {
          angle: fill.angle,
          ...(fill.path === null ? {} : { path: fill.path }),
          stops: fill.stops.map((stop) => ({ position: stop.position, color: cssColor(stop.color) })),
        }
  return {
    preset: row.geometry,
    adjusts: row.adjusts ?? {},
    ...(gradient === undefined ? {} : { gradient }),
  }
}
