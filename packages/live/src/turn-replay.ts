import * as doom from "@airdesign/doom"
import { queueEditOn, releaseBases, releasedBases, shownAfter, type Queued } from "./doom-queue.js"

const setAside: ReadonlySet<doom.Refusal["refused"]> = new Set(["shape", "limit", "person", "run-fenced", "last-slide"])

export const catchingUpResolves = (refused: doom.Refusal["refused"]): boolean => !setAside.has(refused)

export type Pressed = Omit<doom.Pressed, "writes"> & { readonly owned: readonly string[] }

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

export function remember<T>(turned: Map<string, T>, once: string, pressed: T) {
  turned.set(once, pressed)
  const oldest = turned.keys().next().value
  if (turned.size > 500 && oldest !== undefined) turned.delete(oldest)
}

export type Replayed = {
  readonly queue: readonly Queued[]
  readonly view: doom.Doom
  readonly provisional: Map<doom.Rev, string>
  readonly gone: readonly string[]
  readonly steps: ReadonlyMap<string, { readonly before: doom.Doom; readonly writes: readonly doom.Write[] }>
  readonly pressed: ReadonlyMap<string, Pressed>
  readonly refused: ReadonlyMap<string, doom.Refusal>
}

const sliceMilliseconds = 8

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function onStanding(
  server: doom.Doom,
  queue: readonly Queued[],
  turned: ReadonlyMap<string, Pressed>,
  once: string,
  measure: doom.Measure,
  now = performance.now,
): Promise<Replayed | undefined> {
  const head = queue[0]
  const pressed = turned.get(once)
  if (head === undefined || pressed === undefined) return undefined
  const mine = new Set<doom.Rev>()
  for (const name of turned.keys()) {
    const rev = server.onces.get(name)
    if (rev !== undefined) mine.add(rev)
  }
  const headOwned = new Set(mine)
  for (const name of pressed.owned) {
    const rev = server.onces.get(name)
    if (rev !== undefined) headOwned.add(rev)
  }
  const rebuilt = doom.undo(
    server,
    { pressed: { ...pressed, writes: head.edit.writes } },
    { ...head.edit, measure, owned: headOwned },
  )
  if (!doom.isRefusal(rebuilt) && JSON.stringify(rebuilt.edit.writes) === JSON.stringify(head.edit.writes))
    return undefined

  const refused = new Map<string, doom.Refusal>()
  const landing = (name: string, undone: doom.Undoing | doom.Refusal): readonly doom.Write[] => {
    if (!doom.isRefusal(undone)) return undone.edit.writes
    refused.set(name, undone)
    return []
  }
  const kept = landing(head.edit.once, rebuilt)
  const next: Queued[] = []
  const gone: string[] = []
  const steps = new Map<string, { before: doom.Doom; writes: readonly doom.Write[] }>()
  const again = new Map<string, Pressed>()
  const released = new Map<string, ReturnType<typeof releasedBases>>()
  const prefix = new Map<string, { before: doom.Doom; edit: doom.Edit }>()
  const provisional = new Map<doom.Rev, string>()
  let view = server
  const clock = now.bind(performance)
  let deadline = clock() + sliceMilliseconds

  for (const original of queue) {
    if (clock() >= deadline) {
      await nextTask()
      deadline = clock() + sliceMilliseconds
    }
    const each = releaseBases(original, released)
    const name = each.edit.once
    const over = turned.get(name)
    const inverted = over?.owned.at(-1)
    let made: Queued | undefined = each
    if (each === head) {
      made =
        kept.length === 0 ? undefined : { ...head, edit: { ...head.edit, writes: kept }, after: kept.map(() => null) }
    } else if (
      each.edit.readBase === undefined &&
      over !== undefined &&
      inverted !== undefined &&
      over.owned.some((name) => released.has(name))
    ) {
      const prior = prefix.get(inverted)
      const rev = view.onces.get(inverted)
      if (prior === undefined || rev === undefined) made = undefined
      else {
        const extra: doom.Rev[] = []
        for (const own of over.owned) {
          const at = view.onces.get(own)
          if (at === undefined || mine.has(at)) continue
          mine.add(at)
          extra.push(at)
        }
        const undone = doom.undo(
          view,
          { step: { ...prior.edit, author: each.edit.author, rev }, before: prior.before },
          { ...each.edit, measure, owned: mine },
        )
        for (const at of extra) mine.delete(at)
        const writes = landing(name, undone)
        const built = writes.length === 0 ? undefined : queueEditOn(server, view, provisional, { ...each.edit, writes })
        made = built === undefined || doom.isRefusal(built) ? undefined : built
        if (made !== undefined) again.set(name, pressedOn(server, view, writes, over.owned))
      }
    }

    if (made !== each) released.set(name, releasedBases(each, made?.edit.writes ?? []))
    if (made === undefined) {
      gone.push(name)
      continue
    }
    if (made !== each) steps.set(name, { before: view, writes: made.edit.writes })
    next.push(made)
    prefix.set(name, { before: view, edit: made.edit })
    const folded = shownAfter(view, made)
    if (folded !== view) {
      provisional.set(folded.rev, name)
      if (turned.has(name)) mine.add(folded.rev)
      view = folded
    }
  }
  return { queue: next, view, provisional, gone, steps, pressed: again, refused }
}
