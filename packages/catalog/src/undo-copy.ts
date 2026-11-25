const listed = (names: readonly string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names)

function opening(layers: readonly string[]): string {
  const named = listed(layers)
  return named.charAt(0).toUpperCase() + named.slice(1)
}

export const undoRebuildFailed = "Unable to undo. The linked chart can’t be restored. Edit the slide directly."

function undoKeptNote(agent: string, kept: readonly string[], later: readonly string[]): string {
  const layers =
    kept.length === 0
      ? ""
      : kept.length === 1
        ? `${opening(kept)} stays because it was changed after ${agent} made it.`
        : `${opening(kept)} stay because they were changed after ${agent} made them.`
  const changes = later.length === 0 ? "" : `Later changes to ${listed(later)} were kept.`
  return [layers, changes].filter(Boolean).join(" ")
}

export type UndoStays = {
  readonly kept: readonly string[]
  readonly later?: readonly string[]
  readonly left: readonly string[]
  readonly waiting: readonly string[]
  readonly skipped?: readonly string[]
}

export function undoStaysNote(agent: string, stays: UndoStays): string {
  const { kept, later, left, waiting, skipped = [] } = stays
  const leftNote =
    left.length === 0
      ? ""
      : left.length === 1
        ? `${opening(left)} stays where it is, because the place it came from has changed.`
        : `${opening(left)} stay where they are, because the places they came from have changed.`
  const waitingNote =
    waiting.length === 0
      ? ""
      : waiting.length === 1
        ? `${opening(waiting)} can't come back until the frame it was in is back.`
        : `${opening(waiting)} can't come back until the frames they were in are back.`
  const skippedNote =
    skipped.length === 0
      ? ""
      : skipped.length === 1
        ? `The component ${listed(skipped)} was deleted, so its update wasn't undone.`
        : `The components ${listed(skipped)} were deleted, so their updates weren't undone.`
  return [undoKeptNote(agent, kept, later ?? []), leftNote, waitingNote, skippedNote].filter(Boolean).join(" ")
}
