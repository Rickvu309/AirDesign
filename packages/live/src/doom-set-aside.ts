import type { Notice } from "./doom-deck-types.js"
import type { Queued } from "./doom-queue.js"

export function dropNotices(
  queue: readonly Queued[],
  gone: readonly string[],
  once: string,
  refusal: Omit<Notice, "once">,
): readonly Notice[] {
  const dropped = new Set(gone)
  return queue.flatMap((each) => {
    const name = each.edit.once
    if (!dropped.has(name) || each.follows !== undefined) return []
    return [{ once: name, ...(name === once ? refusal : { refused: "stale" as const, because: once }) }]
  })
}
