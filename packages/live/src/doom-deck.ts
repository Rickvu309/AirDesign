import { picturesWantedMilliseconds, readDeckId, type DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import {
  appliedOn,
  dropped,
  landed,
  ownedIn,
  queueEdit,
  readGap,
  revIn,
  sendable,
  shown,
  type Queued,
} from "./doom-queue.js"
import type { DoomRemote } from "./doom-remote.js"
import type {
  DoomDeck,
  DoomOptions,
  Followed,
  Notice,
  Opened,
  Refused,
  Sent,
  Synced,
  Turned,
  TurnedRun,
} from "./doom-deck-types.js"
import { statusOf, type DeckStatus, type Reach } from "./doom-status.js"
import { deviceStorage, type DoomStorage } from "./doom-storage.js"
import { runInLog } from "./run-log.js"
import { watchedRunsOf } from "./watched-runs.js"
import { catchingUpResolves, onStanding, pressedOn, remember, type Pressed } from "./turn-replay.js"

export type { DoomDeck } from "./doom-deck-types.js"

type Step = {
  readonly onces: readonly string[]
  readonly before: doom.Doom
  readonly writes: readonly doom.Write[]
  readonly key?: string
  readonly guarded?: true
  readonly run?: string
}

const retryMilliseconds = 2_000
const estimate = doom.measureWith({})

export async function createDoomDeck(remote: DoomRemote, deck: string, options: DoomOptions = {}): Promise<Opened> {
  return start(remote, deck, "create", options)
}

export async function openDoomDeck(remote: DoomRemote, deck: string, options: DoomOptions = {}): Promise<Opened> {
  return start(remote, deck, "open", options)
}

async function start(remote: DoomRemote, raw: string, how: "create" | "open", options: DoomOptions): Promise<Opened> {
  const id = readDeckId(raw)
  if (!id.ok) return { ok: false, refusal: "deck" }
  const storage = options.storage ?? deviceStorage(id.deck)
  const kept = await storage.read().catch(() => undefined)
  if (how === "open" && kept?.fold !== undefined)
    return { ok: true, deck: connected(remote, id.deck, kept.fold, kept.queue, storage, options) }
  const answer = await remote[how]({ deck: id.deck })
  if (!answer.ok && answer.refusal === "deck") await storage.drop().catch(() => undefined)
  if (!answer.ok) return answer.refusal === "edit" ? { ok: false, refusal: "payload" } : answer
  const queue = kept?.queue ?? []
  await storage.write({ fold: answer.fold, queue }).catch(() => undefined)
  return { ok: true, deck: connected(remote, id.deck, answer.fold, queue, storage, options) }
}

function connected(
  remote: DoomRemote,
  deck: DeckId,
  first: doom.Doom,
  firstQueue: readonly Queued[],
  storage: DoomStorage,
  options: DoomOptions,
): DoomDeck {
  const nextOnce = (options.once ?? crypto.randomUUID).bind(crypto)
  const client = options.client ?? nextOnce().replaceAll("-", "").slice(0, 10)
  const pause = options.pause ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const author: doom.Author = { kind: "person", id: client }
  let counter = 0
  let server = first
  let queue: readonly Queued[] = firstQueue
  let undoSteps: Step[] = []
  let redoSteps: Step[] = []
  const turned = new Map<string, Pressed>()
  let notices: readonly Notice[] = []
  let link: Reach = "reached"
  let kept = true
  let shownStatus: DeckStatus = { kind: "saved" }
  const watched = watchedRunsOf()
  let memo: { readonly server: doom.Doom; readonly queue: readonly Queued[]; readonly view: doom.Doom } | undefined
  let saving: Promise<void> = Promise.resolve()
  let gone = false
  let running: Promise<Synced> | undefined
  let held: AbortController | undefined
  let wanted = false
  let picturesUntil = 0
  const listeners = new Set<() => void>()

  const view = (): doom.Doom => {
    if (memo?.server !== server || memo.queue !== queue) memo = { server, queue, view: shown(server, queue) }
    return memo.view
  }

  const tell = () => {
    for (const listener of listeners) listener()
  }

  const save = (changed: { fold?: doom.Doom; queue?: readonly Queued[] }): Promise<void> => {
    saving = saving
      .then(() => (gone ? undefined : storage.write(changed)))
      .then(
        () => keep(true),
        () => keep(false),
      )
    return saving
  }

  function keep(now: boolean) {
    if (kept === now) return
    kept = now
    tell()
  }

  const leave = async (): Promise<Followed> => {
    gone = true
    saving = saving.then(() => storage.drop()).catch(() => undefined)
    await saving
    return "gone"
  }

  function forget(gone: readonly string[]) {
    const out = (steps: Step[]) =>
      steps.flatMap((step) => {
        const onces = step.onces.filter((once) => !gone.includes(once))
        return onces.length === 0 ? [] : [{ ...step, onces }]
      })
    undoSteps = out(undoSteps)
    redoSteps = out(redoSteps)
  }

  function drop(once: string, refusal: Omit<Notice, "once">) {
    const quiet = new Set(queue.flatMap((each) => (each.follows === undefined ? [] : [each.edit.once])))
    const result = dropped(queue, once)
    if (result.gone.length === 0) return
    queue = result.queue
    notices = [
      ...notices,
      ...result.gone
        .filter((name) => !quiet.has(name))
        .map((name) =>
          name === once ? { once, ...refusal } : { once: name, refused: "stale" as const, because: once },
        ),
    ]
    forget(result.gone)
  }

  function settle() {
    const named = new Set(queue.flatMap((each) => [each.edit.once, ...each.after]))
    for (const once of named) {
      const at = once === null ? undefined : server.onces.get(once)
      if (at !== undefined) queue = landed(queue, once!, at)
    }
  }
  settle()

  function adopt(next: doom.Doom) {
    server = next
    settle()
    void save({ fold: server, queue })
    tell()
  }

  async function resync(): Promise<boolean> {
    const answer = await remote.open({ deck })
    if (!answer.ok) return false
    watched.clear()
    adopt(answer.fold)
    return true
  }

  function apply(edits: readonly unknown[]): boolean {
    let next = server
    for (const raw of edits) {
      const read = doom.readLanded(raw, next)
      if (doom.isRefusal(read)) return false
      if (read.rev <= next.rev) continue
      if (read.rev !== next.rev + 1) return false
      const result = doom.applyEdit(next, read)
      if (doom.isRefusal(result)) return false
      watched.watch(read.author.run, read, next)
      next = result
    }
    if (next !== server) adopt(next)
    return true
  }

  async function catchUp(): Promise<{ readonly ok: boolean }> {
    const answer = await remote.since({ deck, rev: server.rev })
    if (!answer.ok) return { ok: answer.refusal === "cursor" && (await resync()) }
    if (!apply(answer.edits)) return { ok: await resync() }
    while (server.rev < answer.rev) {
      const more = await remote.since({ deck, rev: server.rev })
      if (!more.ok || more.edits.length === 0) return { ok: false }
      if (!apply(more.edits)) return { ok: await resync() }
    }
    return { ok: true }
  }

  async function reach(rev: number): Promise<boolean> {
    while (server.rev < rev) {
      const before = server.rev
      if (!(await catchUp()).ok || server.rev === before) return server.rev >= rev
    }
    return true
  }

  const ownedRevs = (onces: Iterable<string>) => ownedIn(server, queue, onces)

  function standOnly(once: string): boolean {
    const kept = onStanding(server, queue, turned, once, options.measure?.() ?? estimate)
    if (kept === undefined) return false
    queue = kept.queue
    forget(kept.gone)
    const changed = new Set([...kept.gone, ...kept.steps.keys()])
    for (const each of queue) {
      const because = each.afterRead?.find((name) => changed.has(name))
      if (because !== undefined) drop(each.edit.once, { refused: "stale", because })
    }
    const again = (steps: Step[]) =>
      steps.map((step) => {
        const relaid = kept.steps.get(step.onces[0]!)
        return step.onces.length === 1 && relaid !== undefined ? { ...step, ...relaid } : step
      })
    undoSteps = again(undoSteps)
    redoSteps = again(redoSteps)
    for (const [name, pressed] of kept.pressed) turned.set(name, pressed)
    return true
  }

  async function drain(): Promise<Synced> {
    for (;;) {
      const head = queue[0]
      if (head === undefined) return { ok: true }
      const once = head.edit.once
      const built = readGap(server, head) ?? head.after.find((name) => name !== null)
      if (built !== undefined && built !== null) {
        try {
          if (!(await catchUp()).ok) return { ok: false, reason: "offline" }
        } catch {
          return { ok: false, reason: "offline" }
        }
        if (queue[0] === head) {
          drop(once, { refused: "stale", because: built })
          await save({ queue })
          tell()
        }
        continue
      }
      let answer
      try {
        answer = await remote.edit({ deck, edit: sendable(head) })
      } catch {
        return { ok: false, reason: "offline" }
      }
      if (answer.ok) {
        try {
          if (!(await reach(answer.rev))) return { ok: false, reason: "offline" }
        } catch {
          return { ok: false, reason: "offline" }
        }
        if (queue.some((each) => each.edit.once === once)) {
          try {
            if (!(await resync())) return { ok: false, reason: "offline" }
          } catch {
            return { ok: false, reason: "offline" }
          }
        }
        await save({ queue })
        tell()
        continue
      }
      const { refusal } = answer
      const pressed = turned.get(once)
      if (
        refusal === "edit" &&
        head.edit.readBase === undefined &&
        catchingUpResolves(answer.refused) &&
        pressed !== undefined
      ) {
        if (!(await catchUp().catch(() => ({ ok: false }))).ok) return { ok: false, reason: "offline" }
        if (queue[0] !== head || standOnly(once)) {
          await save({ queue })
          tell()
          continue
        }
      }
      if (refusal === "edit") {
        drop(once, {
          refused: answer.refused,
          ...(answer.node === undefined ? {} : { node: answer.node }),
          ...(answer.prop === undefined ? {} : { prop: answer.prop }),
        })
      } else if (refusal === "size" || refusal === "field") {
        drop(once, { refused: refusal === "size" ? "limit" : "shape" })
      } else if (refusal === "stale") return { ok: false, reason: "offline" }
      else return { ok: false, reason: "blocked", refusal }
      await save({ queue })
      tell()
      await catchUp().catch(() => undefined)
    }
  }

  function sync(): Promise<Synced> {
    wanted = true
    if (running !== undefined) return running
    const run = (async (): Promise<Synced> => {
      let result: Synced = { ok: true }
      try {
        while (wanted) {
          wanted = false
          result = await drain()
          link = result.ok ? "reached" : result.reason
          if (!result.ok && !wanted) break
        }
      } finally {
        running = undefined
        if (link !== "reached") held?.abort()
        tell()
      }
      return result
    })()
    running = run
    return run
  }

  function pushEdit(
    asked: readonly doom.Write[],
    by: doom.Author,
    {
      runUndo,
      follows,
      readBase,
      seen,
      last,
    }: {
      runUndo?: doom.RunUndo
      follows?: string
      readBase?: doom.Rev
      seen?: doom.Doom | undefined
      last?: doom.Doom
    } = {},
  ): (Sent & { readonly before: doom.Doom; readonly writes: readonly doom.Write[] }) | Refused {
    const before = view()
    const writes = doom.freeLineEnds(before, asked, options.measure?.() ?? estimate, seen, last)
    const edit: doom.Edit = {
      once: nextOnce(),
      author: by,
      writes,
      ...(runUndo === undefined ? {} : { runUndo }),
      ...(readBase === undefined ? {} : { readBase }),
    }
    const made = queueEdit(server, queue, edit)
    if (doom.isRefusal(made)) return { ok: false, refused: made }
    const trial = appliedOn(before, made.edit)
    if (doom.isRefusal(trial)) return { ok: false, refused: trial }
    queue = [...queue, follows === undefined ? made : { ...made, follows }]
    const saved = save({ queue })
    tell()
    void sync()
    return { ok: true, once: edit.once, saved, before, writes }
  }

  const revOf = (once: string) => revIn(server, queue, once)

  function turn(from: Step[], to: Step[]): Turned {
    const step = from.at(-1)
    const last = step?.onces.at(-1)
    if (step === undefined || last === undefined) return { ok: false, reason: "nothing" }
    const at = revOf(last)
    if (at === undefined) {
      from.pop()
      return { ok: false, reason: "nothing" }
    }
    const now = view()
    const owned = ownedRevs([...turned.keys(), ...step.onces])
    const writes = doom.invert(step.before, now, { once: last, author, writes: step.writes, rev: at }, owned)
    if (writes.length === 0) {
      from.pop()
      return { ok: false, reason: "nothing" }
    }
    const pushed = pushEdit(writes, author, {
      ...(step.run === undefined ? {} : { runUndo: { run: step.run, undone: to === redoSteps } }),
      ...(step.guarded === true ? { readBase: now.rev } : {}),
      last: step.before,
    })
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    from.pop()
    to.push({
      onces: [pushed.once],
      before: now,
      writes: pushed.writes,
      ...(step.run === undefined ? {} : { run: step.run }),
      ...(step.guarded === true ? { guarded: true } : {}),
    })
    remember(turned, pushed.once, pressedOn(server, now, pushed.writes, step.onces))
    return { ok: true, once: pushed.once, saved: pushed.saved }
  }

  async function undoRun(run: string): Promise<TurnedRun> {
    let edits
    let started
    try {
      if (!(await catchUp()).ok) return { ok: false, reason: "offline" }
      started = watched.get(run)?.started
      edits = watched.get(run)?.edits ?? (await runInLog(remote, deck, view(), run))
    } catch {
      return { ok: false, reason: "offline" }
    }
    if (edits === undefined || edits.length === 0 || view().runs.get(run)?.undone === true)
      return { ok: false, reason: "nothing" }
    const now = view()
    const { writes, kept, left, waiting } = doom.invertRun(now, edits, ownedRevs(turned.keys()), started)
    if (writes.length === 0)
      return [...kept, ...left, ...waiting].length === 0
        ? { ok: false, reason: "nothing" }
        : { ok: false, reason: "left", kept, left, waiting }
    const pushed = pushEdit(writes, author, { runUndo: { run, undone: true } })
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    redoSteps.push({ onces: [pushed.once], before: now, writes: pushed.writes, run })
    remember(turned, pushed.once, pressedOn(server, now, pushed.writes))
    return { ok: true, once: pushed.once, saved: pushed.saved, kept, left, waiting }
  }

  async function follow(signal: AbortSignal): Promise<Followed> {
    let wait = false
    while (!signal.aborted) {
      try {
        held = new AbortController()
        const answer = await remote.since(
          { deck, rev: server.rev, wait, ...(Date.now() < picturesUntil ? { pictures: true } : {}) },
          AbortSignal.any([signal, held.signal]),
        )
        if (signal.aborted) return "stopped"
        if (!answer.ok && answer.refusal === "deck") return await leave()
        if (!answer.ok && answer.refusal === "cursor" && (await resync())) continue
        if (!answer.ok) {
          await pause(retryMilliseconds)
          continue
        }
        if (!apply(answer.edits) && !(await resync())) {
          await pause(retryMilliseconds)
          continue
        }
        wait = true
        if (answer.pictures === true) {
          picturesUntil = Date.now() + picturesWantedMilliseconds
          tell()
        }
        if (queue.length > 0) void sync()
      } catch {
        if (signal.aborted) return "stopped"
        wait = false
        await pause(retryMilliseconds)
      }
    }
    return "stopped"
  }

  return {
    deck,
    view,
    server: () => server,
    pending: () => queue.map((each) => each.edit),
    notices: () => notices,
    clearNotices() {
      notices = []
      tell()
    },
    status: () => (shownStatus = statusOf({ unsent: queue.length, reach: link, kept, aside: notices }, shownStatus)),
    mint: () => doom.nodeId(`${client}:${(counter += 1)}`),
    push(asked, pushing) {
      const now = view()
      const read = pushing?.read
      if (read !== undefined && read !== now) return { ok: false, refused: { refused: "stale" } }
      const given = doom.changingWrites(now, asked)
      if (given.length === 0 && read === undefined) return { ok: true, unchanged: true }
      const derived = doom.nameFromTitleWrites(now, given)
      const fromTitle = read === undefined && derived.some((write) => write.prop === "name")
      const own = fromTitle ? given : [...given, ...derived]
      const named = fromTitle ? derived : []
      const pushed = pushEdit(own, pushing?.author ?? author, {
        seen: pushing?.seen,
        ...(read === undefined ? {} : { readBase: read.rev }),
      })
      if (!pushed.ok) return pushed
      const follow =
        named.length === 0 ? undefined : pushEdit(named, pushing?.author ?? author, { follows: pushed.once })
      const writes = follow?.ok === true ? [...pushed.writes, ...follow.writes] : pushed.writes
      const onces = follow?.ok === true ? [pushed.once, follow.once] : [pushed.once]
      const sent = { ok: true, once: pushed.once, saved: pushed.saved } as const
      if (writes.length === 0) return sent
      const open = undoSteps.at(-1)
      if (
        read === undefined &&
        open?.guarded !== true &&
        pushing?.step !== undefined &&
        open?.key === pushing.step &&
        redoSteps.length === 0
      )
        undoSteps[undoSteps.length - 1] = {
          ...open,
          onces: [...open.onces, ...onces],
          writes: [...open.writes, ...writes],
        }
      else
        undoSteps.push({
          onces,
          before: pushed.before,
          writes,
          ...(pushing?.step === undefined ? {} : { key: pushing.step }),
          ...(read === undefined ? {} : { guarded: true }),
        })
      redoSteps = []
      return sent
    },
    undo: () => turn(undoSteps, redoSteps),
    redo: () => turn(redoSteps, undoSteps),
    undoRun,
    sync,
    catchUp,
    follow,
    reportPictures: async (rev, pictures) =>
      remote.pictures === undefined ? { ok: false, refusal: "server" } : remote.pictures({ deck, rev, pictures }),
    picturesWanted: () => Date.now() < picturesUntil,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
