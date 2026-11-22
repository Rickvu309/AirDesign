import type { doom } from "@airdesign/document"

export function deleteWrites(view: doom.Doom, ids: readonly doom.NodeId[]): readonly doom.Write[] {
  return ids.flatMap((id) => (view.nodes.has(id) ? [{ node: id, prop: "parent" as const, value: null }] : []))
}
