import * as doom from "@airdesign/doom"
import { ownedIn, revIn, rewritten, shown, skipped, trimmed, type Queued } from "./doom-queue.js"

const setAside: ReadonlySet<doom.Refusal["refused"]> = new Set(["shape", "limit", "person", "run-fenced", "last-slide"])

export const catchingUpResolves = (refused: doom.Refusal["refused"]): boolean => !setAside.has(refused)

export type Pressed = {
  readonly since: doom.Rev
  readonly measuredIn: ReadonlyMap<doom.NodeId, doom.NodeId | null>
  readonly lines: ReadonlyMap<doom.NodeId, unknown>
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
  lines: new Map(
    writes.flatMap(({ node, prop }) =>
      prop === "geometry" ? [[node, doom.propOf(now.nodes.get(node), "geometry")]] : [],
    ),
  ),
  owned,
})

export function remember(turned: Map<string, Pressed>, once: string, pressed: Pressed) {
  turned.set(once, pressed)
  const oldest = turned.keys().next().value
  if (turned.size > 500 && oldest !== undefined) turned.delete(oldest)
}

function endsOnly(server: doom.Doom, write: doom.Write, pressed: Pressed, at: doom.Rev): doom.Write | undefined {
  if (write.prop !== "geometry") return undefined
  const now = doom.propOf(server.nodes.get(write.node), "geometry")
  const ends = doom.lineEndsBack(write.value, now, pressed.lines.get(write.node))
  return ends === undefined ? undefined : { ...write, value: ends, base: at }
}

export function onStandingOnly(
  server: doom.Doom,
  queue: readonly Queued[],
  pressed: Pressed,
  mine: ReadonlySet<doom.Rev>,
  measure: doom.Measure,
): { readonly queue: readonly Queued[]; readonly skipped: boolean } | undefined {
  const head = queue[0]
  if (head === undefined) return undefined
  const kept = head.edit.writes.flatMap((write) => {
    const at = server.revs.get(write.node)?.get(write.prop)
    const theirs = at !== undefined && at > pressed.since && !mine.has(at) && (write.base ?? 0) < at
    if (!theirs) return [write]
    const ends = endsOnly(server, write, pressed, at)
    return ends === undefined ? [] : [ends]
  })
  const writes = doom.freeLineEnds(
    server,
    doom.onStandingLayers(server, kept, pressed.since, pressed.since, pressed.measuredIn),
    measure,
  )
  if (JSON.stringify(writes) === JSON.stringify(head.edit.writes)) return undefined
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
  measure: doom.Measure,
): Replayed | undefined {
  const pressed = turned.get(once)
  if (pressed === undefined) return undefined
  const ownedBy = (now: readonly Queued[], onces: readonly string[]) =>
    ownedIn(server, now, [...turned.keys(), ...onces])
  const kept = onStandingOnly(server, queue, pressed, ownedBy(queue, pressed.owned), measure)
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
    const was = shown(server, next.slice(0, prior))
    const writes =
      prior < 0 || rev === undefined
        ? []
        : doom.freeLineEnds(
            now,
            doom.invert(
              was,
              now,
              { once: inverted, author: edit.author, writes: next[prior]!.edit.writes, rev },
              ownedBy(next, over.owned),
            ),
            measure,
            now,
            was,
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
