import type { scene } from "@airdesign/document"

export function deleteWrites(view: scene.Scene, ids: readonly scene.NodeId[]): readonly scene.Write[] {
  return ids.flatMap((id) => (view.nodes.has(id) ? [{ node: id, prop: "parent" as const, value: null }] : []))
}
