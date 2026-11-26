import * as doom from "@airdesign/doom"

export type Arrivals = { readonly made: ReadonlySet<doom.NodeId>; readonly changed: ReadonlySet<doom.NodeId> }

const layerTypes: ReadonlySet<doom.NodeType> = new Set(["frame", "shape", "component"])

export const noArrivals: Arrivals = { made: new Set(), changed: new Set() }

function freshAgentRevs(before: doom.Doom, after: doom.Doom, caught: doom.Rev): ReadonlySet<doom.Rev> {
  const moved = new Set<doom.Rev>()
  for (const [id, run] of after.runs)
    if (run.wrote > caught && before.runs.get(id)?.wrote !== run.wrote) moved.add(run.wrote)
  if (moved.size === 0) return moved
  for (const [once, at] of after.onces) if (moved.has(at) && before.onces.has(once)) moved.delete(at)
  return moved
}

function madeAncestor(view: doom.Doom, id: doom.NodeId, made: ReadonlySet<doom.NodeId>): boolean {
  for (let at = doom.parentOf(view.nodes.get(id)); at != null; at = doom.parentOf(view.nodes.get(at.id)))
    if (made.has(at.id)) return true
  return false
}

export function agentArrivals(before: doom.Doom, after: doom.Doom, caught: doom.Rev): Arrivals {
  if (before === after) return noArrivals
  const fresh = freshAgentRevs(before, after, caught)
  if (fresh.size === 0) return noArrivals
  const written = [...after.revs]
    .filter(([id, revs]) => [...revs.values()].some((at) => fresh.has(at)) && isLayer(after, id))
    .map(([id]) => id)
  const isNew = (id: doom.NodeId) => !isLayer(before, id)
  const made = new Set(written.filter(isNew))
  const top = written.filter((id) => !madeAncestor(after, id, made))
  return { made: new Set(top.filter(isNew)), changed: new Set(top.filter((id) => !isNew(id))) }
}

export function agentSlide(before: doom.Doom, after: doom.Doom, caught: doom.Rev): doom.NodeId | undefined {
  if (before === after) return undefined
  const fresh = freshAgentRevs(before, after, caught)
  if (fresh.size === 0) return undefined
  const written = new Set(
    [...after.revs]
      .filter(([, revs]) => [...revs.values()].some((at) => fresh.has(at)))
      .map(([id]) => (after.nodes.get(id)?.type === "slide" ? id : doom.slideOf(after, id))),
  )
  const madeAt = (id: doom.NodeId) => Math.max(...(after.revs.get(id)?.values() ?? []))
  return doom
    .slidesOf(after)
    .filter(({ id }) => !before.nodes.has(id) && written.has(id))
    .reduce<doom.NodeId | undefined>(
      (latest, { id }) => (latest === undefined || madeAt(id) >= madeAt(latest) ? id : latest),
      undefined,
    )
}

function isLayer(view: doom.Doom, id: doom.NodeId): boolean {
  const node = view.nodes.get(id)
  return node !== undefined && layerTypes.has(node.type) && doom.onDeck(view.nodes, id)
}
