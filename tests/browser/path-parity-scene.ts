import { spot } from "./editor-deck"
import paths from "./fixtures/paint-paths.json"
import { ink, markerColor, nearFullColor, polygonFill, wedgeColors } from "./path-parity-art"
import {
  at,
  lines,
  markerSize,
  pies,
  pieCorner,
  pieSize,
  slideSize,
  sweeps,
  sweepSize,
  wedgeOpacity,
} from "./path-parity-score"

type Made = {
  readonly id: string
  readonly type: "frame" | "shape"
  readonly parent: string
  readonly props: Readonly<Record<string, unknown>>
}

const paint = (color: string) => ({ kind: "solid", color, opacity: 1 })

export function parityNodes(): readonly Made[] {
  const root = "parity:1"
  const nodes: Made[] = [
    { id: root, type: "frame", parent: "", props: { name: "Path parity", box: spot(0, 0, slideSize.w, slideSize.h) } },
  ]
  const shape = (parent: string, props: Made["props"]) =>
    nodes.push({ id: `parity:${String(nodes.length + 1)}`, type: "shape", parent, props })
  for (const [index, pie] of pies.entries()) {
    let parent = root
    if (pie.ancestor !== undefined) {
      parent = `ancestor:${String(index)}`
      nodes.push({
        id: parent,
        type: "frame",
        parent: root,
        props: { box: spot(0, 0, slideSize.w, slideSize.h), opacity: pie.ancestor },
      })
    }
    const [x, y] = pieCorner(index)
    for (const [i, d] of (pie.inner === undefined ? paths.wedges : paths.rings).entries()) {
      shape(parent, {
        box: spot(x, y, pieSize, pieSize),
        geometry: { kind: "path", d, fillStroke: true },
        fills: [paint(wedgeColors[i]!)],
        opacity: wedgeOpacity(pie, i),
      })
    }
  }
  for (const {
    corner: [x, y],
    direction,
    ring,
  } of sweeps) {
    const d = ring
      ? direction === 1
        ? paths.positiveRing
        : paths.negativeRing
      : direction === 1
        ? paths.positiveSweep
        : paths.negativeSweep
    shape(root, {
      box: spot(x, y, sweepSize, sweepSize),
      geometry: { kind: "path", d, fillStroke: true },
      fills: [paint(nearFullColor)],
    })
  }
  for (const line of lines) {
    const { x, y, w, h } = line.box
    const d = line.points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${String(x)} ${String(y)}`).join("")
    shape(root, {
      box: spot(x, y, w, h),
      geometry: { kind: "path", d: line.closed ? `${d}Z` : d },
      ...(line.closed ? { fills: [paint(polygonFill)] } : {}),
      strokes: [paint(ink)],
      stroke: { weight: line.weight, align: "center", dash: line.dash },
    })
    if (line.markers)
      for (const point of line.points) {
        const [x, y] = at(line, point)
        shape(root, {
          box: spot(Math.round(x - markerSize / 2), Math.round(y - markerSize / 2), markerSize, markerSize),
          geometry: { kind: "rect" },
          fills: [paint(markerColor)],
        })
      }
  }
  return nodes
}
