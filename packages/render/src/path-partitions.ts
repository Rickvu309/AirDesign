export type Point = readonly [number, number]

export const edgeTolerance = 0.005

const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]
const cross = (a: Point, b: Point): number => a[0] * b[1] - a[1] * b[0]
const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1]

export function pathPoint(text: string): Point | null {
  const [x, y, extra] = text.split(" ").map(Number)
  if (x === undefined || y === undefined || extra !== undefined || !Number.isFinite(x) || !Number.isFinite(y))
    return null
  return [x, y]
}

type Edge = { readonly a: Point; readonly b: Point; readonly outward: Point }
export type Polygon = { readonly vertices: readonly Point[]; readonly edges: readonly Edge[] }

export function convexPath(d: string): Polygon | null {
  if (!/^M[^A-Za-z]+(?:L[^A-Za-z]+){2,15}[Zz]?$/.test(d)) return null
  const vertices: Point[] = []
  for (const text of d.slice(1).replace(/[Zz]$/, "").split("L")) {
    const at = pathPoint(text)
    if (at === null) return null
    vertices.push(at)
  }
  if (distance(vertices[0]!, vertices.at(-1)!) <= edgeTolerance) vertices.pop()
  if (vertices.length < 3) return null

  const area = vertices.reduce((sum, a, i) => sum + cross(a, vertices[(i + 1) % vertices.length]!), 0)
  if (area === 0) return null
  const direction = Math.sign(area)
  const edges: Edge[] = []
  for (const [i, a] of vertices.entries()) {
    const b = vertices[(i + 1) % vertices.length]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const length = Math.hypot(dx, dy)
    if (length <= edgeTolerance) return null
    const outward: Point = [(direction * dy) / length, (-direction * dx) / length]
    if (vertices.some((p) => dot(subtract(p, a), outward) > edgeTolerance)) return null
    edges.push({ a, b, outward })
  }
  return { vertices, edges }
}

function separatingEdges(a: Polygon, b: Polygon) {
  return a.edges.filter(({ a, outward }) => b.vertices.every((p) => dot(subtract(p, a), outward) >= -edgeTolerance))
}

function sharedEdge({ a, b, outward }: Edge, other: Edge): boolean {
  if (
    Math.abs(dot(subtract(other.a, a), outward)) > edgeTolerance ||
    Math.abs(dot(subtract(other.b, a), outward)) > edgeTolerance
  )
    return false
  const along: Point = [-outward[1], outward[0]]
  const end = dot(subtract(b, a), along)
  const from = dot(subtract(other.a, a), along)
  const to = dot(subtract(other.b, a), along)
  return Math.min(Math.max(0, end), Math.max(from, to)) - Math.max(Math.min(0, end), Math.min(from, to)) > edgeTolerance
}

export function polygonPartition(polygons: readonly Polygon[]): boolean {
  let touching = false
  for (const [i, a] of polygons.entries()) {
    for (const b of polygons.slice(i + 1)) {
      const edges = separatingEdges(a, b)
      if (edges.length === 0 && separatingEdges(b, a).length === 0) return false
      if (!touching && edges.some((edge) => b.edges.some((other) => sharedEdge(edge, other)))) touching = true
    }
  }
  return touching
}
