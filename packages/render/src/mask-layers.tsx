import * as doom from "@airdesign/doom"
import { Fragment, type ReactNode, useId } from "react"
import { masksOf, silhouetteIn } from "./silhouette.js"

type Resolved = doom.Resolved

const num = (value: number) => String(Math.round(value * 1000) / 1000)

function reveal(node: Resolved): number {
  const paint = node.fills[0]
  return Math.min(1, Math.max(0, node.opacity * (paint?.opacity ?? 1)))
}

type Run = { readonly mask: Resolved | null; readonly nodes: readonly Resolved[] }

function runsOf(nodes: readonly Resolved[]): readonly Run[] {
  const masks = masksOf(nodes)
  const runs: { mask: Resolved | null; nodes: Resolved[] }[] = []
  nodes.forEach((node, index) => {
    if (node.mask) return
    const mask = masks[index] ?? null
    const last = runs.at(-1)
    if (last !== undefined && last.mask === mask) last.nodes.push(node)
    else runs.push({ mask, nodes: [node] })
  })
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
  const shape = silhouetteIn(mask, doom.identityMatrix)
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
          <path
            d={shape.d}
            fill="white"
            fillOpacity={reveal(mask)}
            transform={`matrix(${shape.matrix.map(num).join(" ")})`}
          />
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
