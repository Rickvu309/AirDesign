import * as doom from "@airdesign/doom"
import { ownedIn, revIn, rewritten, shown, skipped, trimmed, type Queued } from "./doom-queue.js"

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
    pressed.since,
    pressed.measuredIn,
  )
  if (writes.length === head.edit.writes.length && writes.every((write, at) => write === head.edit.writes[at]))
    return undefined
  if (writes.length === 0) return { queue: skipped(queue, head.edit.once), skipped: true }
  return { queue: trimmed(queue, head.edit.once, writes), skipped: false }
}

export type Replayed = {
  readonly queue: readonly Queued[]
  readonly gone: readonly string[]
  readonly steps: ReadonlyMap<string, { readonly before: doom.Doom; readonly writes: readonly doom.Write[] }>
  readonly pressed: ReadonlyMap<string, Pressed>
}

export function onStanding(
  server: doom.Doom,
  queue: readonly Queued[],
  turned: ReadonlyMap<string, Pressed>,
  once: string,
): Replayed | undefined {
  const pressed = turned.get(once)
  if (pressed === undefined) return undefined
  const ownedBy = (now: readonly Queued[], onces: readonly string[]) =>
    ownedIn(server, now, [...turned.keys(), ...onces])
  const kept = onStandingOnly(server, queue, pressed, ownedBy(queue, pressed.owned))
  if (kept === undefined) return undefined
  let next = kept.queue
  const gone: string[] = kept.skipped ? [once] : []
  const steps = new Map<string, { before: doom.Doom; writes: readonly doom.Write[] }>()
  const again = new Map<string, Pressed>()
  const relay = (name: string) => {
    const at = next.findIndex((each) => each.edit.once === name)
    steps.set(name, { before: shown(server, next.slice(0, at)), writes: next[at]!.edit.writes })
  }
  if (!kept.skipped) relay(once)
  const changed = new Set([once])
  for (const { edit } of queue) {
    const over = turned.get(edit.once)
    const inverted = over?.owned.at(-1)
    if (over === undefined || inverted === undefined || !over.owned.some((name) => changed.has(name))) continue
    changed.add(edit.once)
    const at = next.findIndex((each) => each.edit.once === edit.once)
    const prior = next.findIndex((each) => each.edit.once === inverted)
    const rev = revIn(server, next, inverted)
    const now = shown(server, next.slice(0, at))
    const writes =
      prior < 0 || rev === undefined
        ? []
        : doom.invert(
            shown(server, next.slice(0, prior)),
            now,
            { once: inverted, author: edit.author, writes: next[prior]!.edit.writes, rev },
            ownedBy(next, over.owned),
          )
    const made = writes.length === 0 ? undefined : rewritten(server, next, edit.once, writes)
    if (made === undefined || doom.isRefusal(made)) {
      next = skipped(next, edit.once)
      gone.push(edit.once)
      continue
    }
    next = made
    relay(edit.once)
    again.set(edit.once, pressedOn(server, now, writes, over.owned))
  }
  return { queue: next, gone, steps, pressed: again }
}
