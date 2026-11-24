import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"

export function maskable(view: doom.Doom, ids: readonly doom.NodeId[]): readonly doom.NodeId[] {
  return ids.filter((id) => {
    const node = view.nodes.get(id)
    return node?.type === "frame" || node?.type === "shape"
  })
}

export function maskWrites(view: doom.Doom, ids: readonly doom.NodeId[]): readonly doom.Write[] {
  const layers = maskable(view, ids)
  const on = layers.every((id) => propOf(view.nodes.get(id), "mask") === true)
  return layers.map((node) => ({ node, prop: "mask", value: !on }))
}
