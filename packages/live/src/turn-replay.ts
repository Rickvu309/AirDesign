import * as doom from "@airdesign/doom"
import { skipped, trimmed, type Queued } from "./doom-queue.js"

const setAside: ReadonlySet<doom.Refusal["refused"]> = new Set(["shape", "limit", "person", "run-fenced", "last-slide"])

export const catchingUpResolves = (refused: doom.Refusal["refused"]): boolean => !setAside.has(refused)

export type Pressed = {
  readonly since: doom.Rev
  readonly measuredIn: ReadonlyMap<doom.NodeId, doom.NodeId | null>
  readonly owned: readonly string[]
}

export const pressedOn = (
  server: doom.Doom,
  now: doom.Doom,
  writes: readonly doom.Write[],
  owned: readonly string[] = [],
): Pressed => ({
  since: server.rev,
  measuredIn: new Map(writes.map(({ node }) => [node, doom.parentOf(now.nodes.get(node))?.id ?? null])),
  owned,
})

export function remember(turned: Map<string, Pressed>, once: string, pressed: Pressed) {
  turned.set(once, pressed)
  const oldest = turned.keys().next().value
  if (turned.size > 500 && oldest !== undefined) turned.delete(oldest)
}

export function onStandingOnly(
  server: doom.Doom,
  queue: readonly Queued[],
  pressed: Pressed,
  mine: ReadonlySet<doom.Rev>,
): { readonly queue: readonly Queued[]; readonly skipped: boolean } | undefined {
  const head = queue[0]
  if (head === undefined) return undefined
  const theirs = (write: doom.Write) => {
    const at = server.revs.get(write.node)?.get(write.prop)
    return at !== undefined && at > pressed.since && !mine.has(at)
  }
  const writes = doom.onStandingLayers(
    server,
    head.edit.writes.filter((write) => !theirs(write)),
    pressed.since,
    pressed.measuredIn,
  )
  if (writes.length === head.edit.writes.length) return undefined
  if (writes.length === 0) return { queue: skipped(queue, head.edit.once), skipped: true }
  return { queue: trimmed(queue, head.edit.once, writes), skipped: false }
}
