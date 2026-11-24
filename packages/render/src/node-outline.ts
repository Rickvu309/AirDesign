import * as doom from "@airdesign/doom"

type Resolved = doom.Resolved
type Line = Extract<NonNullable<Resolved["geometry"]>, { kind: "line" }>

export type Outline = { readonly fill: string | null; readonly stroke: readonly string[] }

const nothing: Outline = { fill: null, stroke: [] }

const num = (value: number) => String(Math.round(value * 1000) / 1000)

export function roundedRectPath(w: number, h: number, radius: readonly [number, number, number, number]): string {
  const cap = Math.min(w, h) / 2
  const [a, b, c, d] = radius.map((corner) => Math.max(0, Math.min(corner, cap)))
  if (a === 0 && b === 0 && c === 0 && d === 0) return `M0 0H${num(w)}V${num(h)}H0Z`
  return (
    `M${num(a!)} 0H${num(w - b!)}A${num(b!)} ${num(b!)} 0 0 1 ${num(w)} ${num(b!)}` +
    `V${num(h - c!)}A${num(c!)} ${num(c!)} 0 0 1 ${num(w - c!)} ${num(h)}` +
    `H${num(d!)}A${num(d!)} ${num(d!)} 0 0 1 0 ${num(h - d!)}V${num(a!)}A${num(a!)} ${num(a!)} 0 0 1 ${num(a!)} 0Z`
  )
}

export function ellipsePath(w: number, h: number): string {
  const rx = w / 2
  const ry = h / 2
  return `M0 ${num(ry)}A${num(rx)} ${num(ry)} 0 1 0 ${num(w)} ${num(ry)}A${num(rx)} ${num(ry)} 0 1 0 0 ${num(ry)}Z`
}

export function routePath({ route, points }: Pick<Line, "route" | "points">): string {
  const [first, ...rest] = points
  if (first === undefined) return ""
  const start = `M${num(first.x)} ${num(first.y)}`
  const spot = (point: { readonly x: number; readonly y: number }) => `${num(point.x)} ${num(point.y)}`
  if (route === "curve" && rest.length === 3) return `${start}C${rest.map(spot).join(" ")}`
  return `${start}${rest.map((point) => `L${spot(point)}`).join("")}`
}

export function outlineOf(node: Resolved): Outline {
  const { w, h } = node.box
  const geometry = node.geometry
  if (geometry === null || geometry.kind === "rect") {
    const d = roundedRectPath(w, h, node.radius)
    return { fill: d, stroke: [d] }
  }
  if (geometry.kind === "ellipse") {
    const d = ellipsePath(w, h)
    return { fill: d, stroke: [d] }
  }
  if (geometry.kind === "path") return { fill: geometry.d, stroke: [geometry.d] }
  if (geometry.kind === "line") return { fill: null, stroke: [routePath(geometry)] }
  if (geometry.kind === "icon") return nothing
  const paths = doom.presetOutline(geometry.name, w, h, geometry.adjust)
  if (paths === null) {
    const d = roundedRectPath(w, h, node.radius)
    return { fill: d, stroke: [d] }
  }
  const filled = paths.filter((path) => path.fill).map((path) => path.d)
  return {
    fill: filled.length === 0 ? null : filled.join(""),
    stroke: paths.filter((path) => path.stroke).map((path) => path.d),
  }
}

export function maskSilhouette(node: Resolved): string {
  return outlineOf(node).fill ?? roundedRectPath(node.box.w, node.box.h, node.radius)
}
