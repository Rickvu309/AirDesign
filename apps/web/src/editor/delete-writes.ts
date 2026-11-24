import * as doom from "@airdesign/doom"

export function deleteWrites(
  view: doom.Doom,
  ids: readonly doom.NodeId[],
  measure: doom.Measure,
): readonly doom.Write[] {
  const gone = ids.filter((id) => view.nodes.has(id))
  return [
    ...doom.freedLineEnds(view, gone, measure),
    ...gone.map((id) => ({ node: id, prop: "parent" as const, value: null })),
  ]
}
