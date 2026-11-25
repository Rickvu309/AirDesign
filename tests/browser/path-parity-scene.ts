import * as doom from "../../packages/doom/src/index.ts"
import { expandComponent, readComponentSpec } from "../../packages/doom/src/component/index.ts"
import { spot } from "./editor-deck"
import { ink, markerColor, nearFullColor, polygonFill, wedgeColors } from "./path-parity-art"
import {
  at,
  lines,
  markerSize,
  pies,
  pieCorner,
  pieSize,
  ringInner,
  slideSize,
  sweeps,
  sweepSize,
  sweepStart,
  wedgeOpacity,
} from "./path-parity-score"

export type Made = {
  readonly id: string
  readonly type: "frame" | "shape"
  readonly parent: string
  readonly props: Readonly<Record<string, unknown>>
}

const wedge = (
  key: string,
  [x, y]: readonly [number, number],
  size: number,
  inner: number,
  from: number,
  to: number,
) => ({
  emit: {
    kind: "path",
    key: ["list", key],
    x,
    y,
    w: size,
    h: size,
    fill: nearFullColor,
    d: ["wedge", ["point", 0.5, 0.5], inner, 0.5, from, to],
  },
})

const lineParts = lines.flatMap((line, index) => [
  {
    emit: {
      kind: "path",
      key: ["list", `line-${String(index)}`],
      ...line.box,
      d: ["polyline", ["list", ...line.points.map(([x, y]) => ["point", x, y])]],
      stroke: { color: ink, width: line.weight },
    },
  },
  ...(line.markers
    ? line.points.map((point, at_) => ({
        emit: {
          kind: "rect",
          key: ["list", `marker-${String(index)}-${String(at_)}`],
          x: at(line, point)[0] - markerSize / 2,
          y: at(line, point)[1] - markerSize / 2,
          w: markerSize,
          h: markerSize,
          fill: markerColor,
        },
      }))
    : []),
])

const parts = [
  ...pies.flatMap((pie, index) =>
    wedgeColors.map((_, i) =>
      wedge(`pie-${String(index)}-${String(i)}`, pieCorner(index), pieSize, pie.inner ?? 0, i / 5, (i + 1) / 5),
    ),
  ),
  ...sweeps.map(({ corner, delta, direction, ring }, i) =>
    wedge(
      `sweep-${String(i)}`,
      corner,
      sweepSize,
      ring ? ringInner : 0,
      sweepStart(direction),
      sweepStart(direction) + direction * (1 - delta),
    ),
  ),
  ...lineParts,
]

const paint = (color: string) => ({ kind: "solid", color, opacity: 1 })
const pathOf = (props: Readonly<Record<string, unknown>>) => props.geometry as { readonly d: string }

function styled(
  id: string,
  root: string,
  child: { readonly key: readonly string[]; readonly props: unknown },
  ancestors: Map<number, Made>,
): Made {
  const [kind, first, second] = child.key[0]!.split("-")
  const props = child.props as Readonly<Record<string, unknown>>
  if (kind === "pie") {
    const index = Number(first)
    const pie = pies[index]!
    let parent = root
    if (pie.ancestor !== undefined) {
      const frame = ancestors.get(index) ?? {
        id: `ancestor:${String(index)}`,
        type: "frame" as const,
        parent: root,
        props: { box: spot(0, 0, slideSize.w, slideSize.h), opacity: pie.ancestor },
      }
      ancestors.set(index, frame)
      parent = frame.id
    }
    return {
      id,
      type: "shape",
      parent,
      props: {
        ...props,
        geometry: { ...pathOf(props), fillStroke: true },
        fills: [paint(wedgeColors[Number(second)]!)],
        opacity: wedgeOpacity(pie, Number(second)),
      },
    }
  }
  if (kind === "sweep")
    return { id, type: "shape", parent: root, props: { ...props, geometry: { ...pathOf(props), fillStroke: true } } }
  if (kind === "line") {
    const line = lines[Number(first)]!
    return {
      id,
      type: "shape",
      parent: root,
      props: {
        ...props,
        geometry: { kind: "path", d: line.closed ? `${pathOf(props).d}Z` : pathOf(props).d },
        ...(line.closed ? { fills: [paint(polygonFill)] } : {}),
        stroke: { weight: line.weight, align: "center", dash: line.dash },
      },
    }
  }
  return { id, type: "shape", parent: root, props }
}

const perExpansion = 60

export function parityNodes(): readonly Made[] {
  const ancestors = new Map<number, Made>()
  const roots: Made[] = []
  const children: Made[] = []
  for (let from = 0; from < parts.length; from += perExpansion) {
    const spec = readComponentSpec({
      version: 1,
      name: "Path parity",
      collections: {},
      parts: parts.slice(from, from + perExpansion),
    })
    if (doom.isRefusal(spec)) throw new Error(JSON.stringify(spec))
    const tree = expandComponent(spec, {
      data: {},
      frame: { x: 0, y: 0, w: slideSize.w, h: slideSize.h },
      theme: doom.defaultTheme,
      measure: doom.measureWith({}),
    })
    if (doom.isRefusal(tree)) throw new Error(JSON.stringify(tree))
    const order = String(from / perExpansion)
    const root = `parity${order}:1`
    roots.push({ id: root, type: "frame", parent: "", props: { name: tree.props.name, box: tree.props.box } })
    tree.children.forEach((child, index) =>
      children.push(styled(`parity${order}:${String(index + 2)}`, root, child, ancestors)),
    )
  }
  return [...roots, ...ancestors.values(), ...children]
}
