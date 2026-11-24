import { readDeckId, type DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import {
  acceptedWithoutRow,
  appliedOn,
  regenerationFor,
  type Regeneration,
  type Suppression,
  dropped,
  landed,
  ownedAt,
  queueEditOn,
  readGap,
  sendable,
  settled,
  queueProjection,
  type Queued,
} from "./doom-queue.js"
import type { DoomRemote } from "./doom-remote.js"
import type {
  DoomDeck,
  DoomOptions,
  Notice,
  Opened,
  Refused,
  Sent,
  Synced,
  Turned,
  TurnedRun,
} from "./doom-deck-types.js"
import { catchDoom, foldCaught, followDoom } from "./doom-follow.js"
import {
  dropNotices,
  rebuilds,
  replayLinked,
  suppressionsOf,
  suppressWrites,
  loadRunUndos,
  type RunUndoSource,
} from "./doom-set-aside.js"
import { forgetSteps, recordStep, relaySteps, type Step } from "./doom-steps.js"
import { statusOf, type DeckStatus, type Reach } from "./doom-status.js"
import { deviceStorage, keepDoom, type DoomStorage } from "./doom-storage.js"
import { runInLog } from "./run-log.js"
import { watchedRunsOf } from "./watched-runs.js"
import { catchingUpResolves, onStanding, pressedOn, remember, type Pressed } from "./turn-replay.js"

export type { DoomDeck } from "./doom-deck-types.js"

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
  const measure = () => options.measure?.() ?? estimate
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
  const runUndoSources = new Map<string, RunUndoSource>()
  let notices: readonly Notice[] = []
  let link: Reach = "reached"
  let kept = true
  let shownStatus: DeckStatus = { kind: "saved" }
  const watched = watchedRunsOf()
  const projection = queueProjection()
  let running: Promise<Synced> | undefined
  let wanted = false
  const listeners = new Set<() => void>()

  const view = () => projection.read(server, queue).view

  const mint = () => doom.nodeId(`${client}:${(counter += 1)}`)

  const tell = () => {
    for (const listener of listeners) listener()
  }

  const { save, leave: leaveStorage } = keepDoom(storage, keep)
  let gone = false

  async function leave() {
    gone = true
    return leaveStorage()
  }

  function keep(now: boolean) {
    if (kept === now) return
    kept = now
    tell()
  }

  function forget(gone: readonly string[]) {
    undoSteps = forgetSteps(undoSteps, gone)
    redoSteps = forgetSteps(redoSteps, gone)
  }

  async function drop(once: string, refusal: Omit<Notice, "once">) {
    if (refusal.refused === "stale")
      await loadRunUndos(queue, once, runUndoSources, async (run) => {
        const edits = await runInLog(remote, deck, view(), run)
        return edits === "size" ? undefined : edits
      })
    const before = queue
    const result = dropped(queue, once)
    if (result.gone.length === 0) return
    const head = before.find((each) => each.edit.once === once)
    if (refusal.refused === "stale" && head !== undefined && rebuilds(head)) {
      const rebuilt = replayLinked(server, before, result.gone, measure(), turned.keys(), runUndoSources)
      queue = rebuilt.queue
      forget(rebuilt.gone)
      undoSteps = relaySteps(undoSteps, rebuilt.steps)
      redoSteps = relaySteps(redoSteps, rebuilt.steps)
      notices = [...notices, ...rebuilt.notices]
      return
    }
    queue = result.queue
    forget(result.gone)
    notices = [...notices, ...dropNotices(before, result.gone, once, refusal)]
  }

  queue = settled(server, queue)

  function adopt(next: doom.Doom) {
    server = next
    queue = settled(server, queue)
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
    const next = foldCaught(server, edits, watched.watch)
    if (next === undefined) return false
    if (next !== server) adopt(next)
    return true
  }

  const catchUp = () =>
    catchDoom({ deck, since: (body) => remote.since(body), revision: () => server.rev, apply, resync })

  async function reach(rev: number): Promise<boolean> {
    while (server.rev < rev) {
      const before = server.rev
      if (!(await catchUp()).ok || server.rev === before) return server.rev >= rev
    }
    return true
  }

  const ownedRevs = (onces: Iterable<string>) => ownedAt(view(), onces)

  async function standOnly(once: string): Promise<boolean> {
    const fold = server
    const pending = queue
    const kept = await onStanding(fold, pending, turned, once, measure())
    if (gone || server !== fold || queue !== pending) return true
    if (kept === undefined) return false
    queue = kept.queue
    forget(kept.gone)
    const changed = new Set([...kept.gone, ...kept.steps.keys()])
    for (const each of queue) {
      const because = each.afterRead?.find((name) => changed.has(name))
      if (because !== undefined) await drop(each.edit.once, { refused: "stale", because })
    }
    if (queue === kept.queue) projection.adopt(fold, queue, kept.view, kept.provisional)
    undoSteps = relaySteps(undoSteps, kept.steps)
    redoSteps = relaySteps(redoSteps, kept.steps)
    for (const [name, pressed] of kept.pressed) turned.set(name, pressed)
    return true
  }

  function reached() {
    if (link === "reached") return
    link = "reached"
    tell()
  }

  async function drain(): Promise<Synced> {
    const offline = { ok: false, reason: "offline" } as const
    for (;;) {
      const head = queue[0]
      if (head === undefined) return { ok: true }
      const once = head.edit.once
      const built = readGap(server, head) ?? head.after.find((name) => name !== null)
      if (built !== undefined && built !== null) {
        if (!(await catchUp().catch(() => ({ ok: false }))).ok) return offline
        reached()
        if (queue[0] === head) {
          try {
            await drop(once, { refused: "stale", because: built })
          } catch {
            return offline
          }
          await save({ queue })
          tell()
        }
        continue
      }
      let answer
      try {
        answer = await remote.edit({ deck, edit: sendable(head) })
      } catch {
        return offline
      }
      if (answer.ok || answer.refusal === "edit" || answer.refusal === "size" || answer.refusal === "field") reached()
      if (answer.ok) {
        if (!(await reach(answer.rev).catch(() => false))) return offline
        if (acceptedWithoutRow(head.edit, answer.rev)) queue = landed(queue, once, server.rev)
        if (queue.some((each) => each.edit.once === once) && !(await resync().catch(() => false))) return offline
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
        if (!(await catchUp().catch(() => ({ ok: false }))).ok) return offline
        if (queue[0] !== head || (await standOnly(once))) {
          if (gone) return { ok: false, reason: "blocked", refusal: "deck" }
          await save({ queue })
          tell()
          continue
        }
      }
      if ((refusal === "edit" || refusal === "field" || refusal === "size") && queue.some(rebuilds)) {
        if (!(await catchUp().catch(() => ({ ok: false }))).ok) return offline
        if (queue[0]?.edit.once !== once) continue
      }
      if (refusal === "edit") {
        try {
          await drop(once, {
            refused: answer.refused,
            ...(answer.node === undefined ? {} : { node: answer.node }),
            ...(answer.prop === undefined ? {} : { prop: answer.prop }),
          })
        } catch {
          return offline
        }
      } else if (refusal === "size" || refusal === "field") {
        await drop(once, { refused: refusal === "size" ? "limit" : "shape" })
      } else if (refusal === "stale") return offline
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
        if (link !== "reached") following.wake()
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
      regeneration,
      suppressions,
      turnFrom,
      turnSource,
    }: {
      runUndo?: doom.RunUndo
      follows?: string
      readBase?: doom.Rev
      seen?: doom.Doom | undefined
      last?: doom.Doom
      regeneration?: Regeneration
      suppressions?: readonly Suppression[]
      turnFrom?: readonly string[]
      turnSource?: doom.RunEdit
    } = {},
  ): (Sent & { readonly before: doom.Doom; readonly writes: readonly doom.Write[] }) | Refused {
    const { view: before, provisional } = projection.read(server, queue)
    const writes = doom.freeLineEnds(before, asked, measure(), seen, last)
    const edit: doom.Edit = {
      once: nextOnce(),
      author: by,
      writes,
      ...(runUndo === undefined ? {} : { runUndo }),
      ...(readBase === undefined ? {} : { readBase }),
    }
    const made = queueEditOn(server, before, provisional, edit)
    if (doom.isRefusal(made)) return { ok: false, refused: made }
    const trial = appliedOn(before, made.edit)
    if (doom.isRefusal(trial)) return { ok: false, refused: trial }
    queue = [
      ...queue,
      {
        ...made,
        ...(follows === undefined ? {} : { follows }),
        ...(regeneration === undefined ? {} : { regeneration }),
        ...(suppressions === undefined ? {} : { suppressions }),
        ...(turnFrom === undefined ? {} : { turnFrom }),
        ...(turnSource === undefined ? {} : { turnSource }),
      },
    ]
    projection.append(server, queue, trial, edit.once)
    const saved = save({ queue })
    tell()
    void sync()
    return { ok: true, once: edit.once, saved, before, writes }
  }

  function turn(from: Step[], to: Step[]): Turned {
    const step = from.at(-1)
    const last = step?.onces.at(-1)
    if (step === undefined || last === undefined) return { ok: false, reason: "nothing" }
    const now = view()
    const at = now.onces.get(last)
    if (at === undefined) {
      from.pop()
      return { ok: false, reason: "nothing" }
    }
    const owned = ownedRevs([...turned.keys(), ...step.onces])
    const source = { once: last, author, writes: step.writes, rev: at }
    const writes = doom.invertStep(step.before, now, source, owned, measure())
    if (doom.isRefusal(writes)) {
      const turn = to === redoSteps ? "undo" : "redo"
      notices = [
        ...notices.filter((notice) => notice.once !== last || notice.turn !== turn),
        { ...writes, once: last, turn },
      ]
      tell()
      return { ok: false, reason: "refused", refused: writes }
    }
    if (writes.length === 0) {
      from.pop()
      return { ok: false, reason: "nothing" }
    }
    const linked = step.writes.some(({ prop }) => prop === "instance")
    const pushed = pushEdit(writes, author, {
      ...(step.run === undefined ? {} : { runUndo: { run: step.run, undone: to === redoSteps } }),
      ...(step.guarded === true ? { readBase: now.rev } : {}),
      ...(linked
        ? {
            turnFrom: [...new Set([...turned.keys(), ...step.onces.filter((once) => once !== last)]), last],
            turnSource: doom.undoSourceOf(step.before, source),
          }
        : {}),
      last: step.before,
    })
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    notices = notices.filter((notice) => notice.once !== last || notice.turn === undefined)
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
    if (edits === "size") return { ok: false, reason: "size" }
    if (edits === undefined || edits.length === 0 || view().runs.get(run)?.undone === true)
      return { ok: false, reason: "nothing" }
    const now = view()
    const { writes, kept, left, waiting, refused } = doom.invertRun(
      now,
      edits,
      ownedRevs(turned.keys()),
      started,
      measure(),
    )
    if (refused !== undefined) return { ok: false, reason: "refused", refused }
    if (writes.length === 0)
      return [...kept, ...left, ...waiting].length === 0
        ? { ok: false, reason: "nothing" }
        : { ok: false, reason: "left", kept, left, waiting }
    const guarded = writes.some(({ prop }) => prop === "instance")
    if (guarded) remember(runUndoSources, run, { edits, ...(started === undefined ? {} : { started }) })
    const pushed = pushEdit(writes, author, {
      runUndo: { run, undone: true },
      ...(guarded ? { readBase: now.rev } : {}),
    })
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    redoSteps.push({
      onces: [pushed.once],
      before: now,
      writes: pushed.writes,
      run,
      ...(guarded ? { guarded: true } : {}),
    })
    remember(turned, pushed.once, pressedOn(server, now, pushed.writes))
    return { ok: true, once: pushed.once, saved: pushed.saved, kept, left, waiting }
  }

  function push(
    asked: readonly doom.Write[],
    pushing?: Parameters<DoomDeck["push"]>[1],
    regeneration?: Regeneration,
  ): ReturnType<DoomDeck["push"]> {
    const now = view()
    if (pushing?.read !== undefined && pushing.read !== now) return { ok: false, refused: { refused: "stale" } }
    const suppressions = regeneration === undefined ? suppressionsOf(now, asked) : []
    const read = suppressions.length === 0 ? pushing?.read : now
    const prepared = suppressions.length === 0 ? asked : suppressWrites(now, asked, suppressions)
    if (doom.isRefusal(prepared)) return { ok: false, refused: prepared }
    const given = doom.changingWrites(now, prepared)
    if (given.length === 0) return { ok: true, unchanged: true }
    const derived = doom.nameFromTitleWrites(now, given)
    const fromTitle = read === undefined && derived.some((write) => write.prop === "name")
    const own = fromTitle ? given : [...given, ...derived]
    const named = fromTitle ? derived : []
    const pushed = pushEdit(own, pushing?.author ?? author, {
      seen: pushing?.seen,
      ...(regeneration === undefined ? {} : { regeneration }),
      ...(suppressions.length === 0 ? {} : { suppressions }),
      ...(read === undefined ? {} : { readBase: read.rev }),
    })
    if (!pushed.ok) return pushed
    const follow = named.length === 0 ? undefined : pushEdit(named, pushing?.author ?? author, { follows: pushed.once })
    const writes = follow?.ok === true ? [...pushed.writes, ...follow.writes] : pushed.writes
    const onces = follow?.ok === true ? [pushed.once, follow.once] : [pushed.once]
    const sent = { ok: true, once: pushed.once, saved: pushed.saved } as const
    if (writes.length === 0) return sent
    recordStep(
      undoSteps,
      {
        onces,
        before: pushed.before,
        writes,
        ...(pushing?.step === undefined ? {} : { key: pushing.step }),
        ...(read === undefined ? {} : { guarded: true }),
      },
      read === undefined && redoSteps.length === 0,
    )
    redoSteps = []
    return sent
  }

  function regenerate(frame: doom.NodeId, patch: doom.ComponentPatch): ReturnType<DoomDeck["regenerate"]> {
    const read = view()
    const update = doom.regenerateComponent(read, frame, patch, measure())
    if (doom.isRefusal(update)) return { ok: false, refused: update }
    const pushed = push(update.writes, { read }, regenerationFor(frame, patch))
    return pushed.ok ? { ...pushed, findings: update.findings } : pushed
  }

  const following = followDoom({
    deck,
    since: (body, signal) => remote.since(body, signal),
    revision: () => server.rev,
    leave,
    resync,
    apply,
    tell,
    pause,
    send: () => {
      if (queue.length > 0) void sync()
    },
  })

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
    mint,
    push,
    regenerate,
    undo: () => turn(undoSteps, redoSteps),
    redo: () => turn(redoSteps, undoSteps),
    undoRun,
    sync,
    catchUp,
    follow: following.follow,
    reportPictures: async (rev, pictures) =>
      remote.pictures === undefined ? { ok: false, refusal: "server" } : remote.pictures({ deck, rev, pictures }),
    picturesWanted: following.picturesWanted,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
