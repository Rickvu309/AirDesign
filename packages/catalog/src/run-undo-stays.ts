import type * as doom from "@airdesign/doom"

type Stays = Pick<doom.Undone, "kept" | "left" | "waiting">

export function runUndoStays(
  edits: readonly doom.RunEdit[],
  stays: Stays,
): Stays & {
  readonly later?: readonly doom.NodeId[]
} {
  const created = new Set(
    edits.flatMap(({ writes }) => writes.filter(({ prop }) => prop === "type").map(({ node }) => node)),
  )
  const later = stays.kept.filter((node) => !created.has(node))
  const { kept, left, waiting } = stays
  return { kept, left, waiting, ...(later.length === 0 ? {} : { later }) }
}
