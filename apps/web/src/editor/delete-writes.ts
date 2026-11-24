import * as doom from "@airdesign/doom"

export function deleteWrites(view: doom.Doom, ids: readonly doom.NodeId[]): readonly doom.Write[] {
  return ids.filter((id) => view.nodes.has(id)).map((id) => ({ node: id, prop: "parent" as const, value: null }))
}
