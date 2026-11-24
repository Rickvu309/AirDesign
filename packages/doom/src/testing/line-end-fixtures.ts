import { doomFromTree } from "../doom-tree.js"
import type { Node } from "../doom.js"
import { parentOf, propOf } from "../doom-walk.js"
import type { End } from "../geometry.js"
import type { NodeId } from "../ids.js"
import { applyEdit, isRefusal, rev, resolveSlide, type Doom, type Landed, type Measure, type Write } from "../index.js"
import type { Point, Resolved } from "../resolved.js"
import { measure, plainTheme, spot } from "./doom-fixtures-art.js"

export const person = { kind: "person" as const, id: "p" }

type Matrix = readonly [number, number, number, number, number, number]

function turnedBy([a, b, c, d, e, f]: Matrix, node: Resolved): Matrix {
  const { x, y, w, h, rotation } = node.box
  const cos = Math.cos((rotation * Math.PI) / 180)
  const sin = Math.sin((rotation * Math.PI) / 180)
  const [g, i, k, l] = [cos, -sin, x + w / 2 - cos * (w / 2) + sin * (h / 2), y + h / 2 - sin * (w / 2) - cos * (h / 2)]
  const [hh, j] = [sin, cos]
  return [a * g + c * hh, b * g + d * hh, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f]
}

function placed(
  nodes: readonly Resolved[],
  id: string,
  parent: Matrix = [1, 0, 0, 1, 0, 0],
): { readonly matrix: Matrix; readonly node: Resolved } | null {
  for (const node of nodes) {
    const matrix = turnedBy(parent, node)
    if (node.id === id) return { matrix, node }
    const kid = placed(node.children, id, matrix)
    if (kid !== null) return kid
  }
  return null
}

export function startOf(doom: Doom, slide: NodeId, line: NodeId, by: Measure = measure): Point {
  const found = placed(resolveSlide(doom, slide, by), line)
  if (found?.node.geometry?.kind !== "line") throw new Error("no line")
  const [a, b, c, d, e, f] = found.matrix
  const { x, y } = found.node.geometry.from
  const settle = (value: number) => Math.round(value * 1e6) / 1e6
  return { x: settle(a * x + c * y + e), y: settle(b * x + d * y + f) }
}

export function lineOf(doom: Doom, id: NodeId) {
  const geometry = propOf(doom.nodes.get(id), "geometry")
  if (geometry?.kind !== "line") throw new Error("no line")
  return geometry
}

export const attached = (ids: Readonly<Record<string, NodeId>>) => ({
  geometry: {
    kind: "line" as const,
    start: { node: ids.t!, site: "r" as const },
    end: { x: 10, y: 10 },
    route: "straight" as const,
    arrows: ["none", "none"] as const,
  },
})

export function deck() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          { type: "shape", name: "t", props: { box: spot(300, 300, 100, 50) } },
          {
            type: "frame",
            name: "j",
            props: { box: spot(100, 100, 400, 200) },
            children: [{ type: "shape", name: "l", props: attached }],
          },
        ],
      },
      { name: "two", children: [] },
    ],
  })
}

export function step(doom: Doom, once: string, writes: readonly Write[]) {
  const edit: Landed = { once, author: person, writes, rev: rev(doom.rev + 1) }
  const after = applyEdit(doom, edit)
  if (isRefusal(after)) throw new Error(JSON.stringify(after))
  return { before: doom, after, edit }
}

export function detach(ids: readonly NodeId[]): readonly Write[] {
  return ids.map((id) => ({ node: id, prop: "parent" as const, value: null }))
}

export function freePoint(end: End): Point {
  if ("node" in end) throw new Error("still attached")
  return { x: end.x, y: end.y }
}

export function deletedUnfreed(doom: Doom, id: NodeId): Doom {
  const node = doom.nodes.get(id)!
  const parent = parentOf(node)!
  return {
    ...doom,
    nodes: new Map(doom.nodes).set(id, { ...node, parent: null } as Node),
    children: new Map(doom.children).set(
      parent.id,
      (doom.children.get(parent.id) ?? []).filter((child) => child !== id),
    ),
  }
}
