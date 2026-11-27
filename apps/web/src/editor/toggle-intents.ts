import * as doom from "@airdesign/doom"

export type Toggle = "hidden" | "locked" | "mask"

export function togglable(view: doom.Doom, ids: readonly doom.NodeId[]): readonly doom.NodeId[] {
  return ids.filter((id) => {
    const node = view.nodes.get(id)
    return (node?.type === "frame" || node?.type === "shape") && doom.isLive(node)
  })
}

export function toggleIntents(view: doom.Doom, ids: readonly doom.NodeId[], prop: Toggle): readonly doom.Intent[] {
  const layers = togglable(view, ids)
  const on = layers.every((id) => doom.propOf(view.nodes.get(id), prop) === true)
  return layers.map((target) => ({ op: "update", target, [prop]: !on }))
}
