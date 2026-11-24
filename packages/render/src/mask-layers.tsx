import type * as doom from "@airdesign/doom"
import { Fragment, type ReactNode, useId } from "react"
import { outlineOf, roundedRectPath } from "./node-outline.js"

type Resolved = doom.Resolved

const num = (value: number) => String(Math.round(value * 1000) / 1000)

function reveal(node: Resolved): number {
  const paint = node.fills[0]
  return Math.min(1, Math.max(0, node.opacity * (paint?.opacity ?? 1)))
}

function place(node: Resolved): string {
  const { x, y, w, h, rotation, flipH, flipV } = node.box
  const moved = `translate(${num(x)} ${num(y)})`
  if (rotation === 0 && !flipH && !flipV) return moved
  const turn = rotation === 0 ? "" : ` rotate(${num(rotation)})`
  const flip = flipH || flipV ? ` scale(${flipH ? -1 : 1} ${flipV ? -1 : 1})` : ""
  return `${moved} translate(${num(w / 2)} ${num(h / 2)})${turn}${flip} translate(${num(-w / 2)} ${num(-h / 2)})`
}

function silhouette(node: Resolved): string {
  return outlineOf(node).fill ?? roundedRectPath(node.box.w, node.box.h, node.radius)
}

type Run = { readonly mask: Resolved | null; readonly nodes: readonly Resolved[] }

function runsOf(nodes: readonly Resolved[]): readonly Run[] {
  const runs: Run[] = []
  let mask: Resolved | null = null
  let batch: Resolved[] = []
  const flush = () => {
    if (batch.length === 0) return
    runs.push({ mask, nodes: batch })
    batch = []
  }
  for (const node of nodes) {
    if (node.mask) {
      flush()
      mask = node
      continue
    }
    batch.push(node)
  }
  flush()
  return runs
}

function MaskRun({
  mask,
  nodes,
  render,
}: {
  readonly mask: Resolved
  readonly nodes: readonly Resolved[]
  readonly render: (node: Resolved) => ReactNode
}) {
  const id = `m${useId().replace(/[^\w-]/g, "")}`
  return (
    <>
      <svg
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
          <path d={silhouette(mask)} fill="white" fillOpacity={reveal(mask)} transform={place(mask)} />
        </mask>
      </svg>
      <div style={{ position: "absolute", inset: 0, mask: `url(#${id})` }}>{nodes.map(render)}</div>
    </>
  )
}

export function MaskedChildren({
  nodes,
  render,
}: {
  readonly nodes: readonly Resolved[]
  readonly render: (node: Resolved) => ReactNode
}) {
  return runsOf(nodes).map((run) =>
    run.mask === null ? (
      <Fragment key={run.nodes[0]!.id}>{run.nodes.map(render)}</Fragment>
    ) : (
      <MaskRun key={run.mask.id} mask={run.mask} nodes={run.nodes} render={render} />
    ),
  )
}
