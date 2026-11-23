import {
  picturesWantedMilliseconds,
  readDeckId,
  type DeckId,
  type DoomPictured,
  type DoomRefusal,
  type SlidePictures,
} from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { appliedOn, dropped, landed, provisionalRevs, queueEdit, sendable, shown, type Queued } from "./doom-queue.js"
import type { DoomRemote } from "./doom-remote.js"
import { deviceStorage, type DoomStorage } from "./doom-storage.js"

export type Notice = {
  readonly once: string
  readonly refused: doom.Refusal["refused"]
  readonly node?: doom.NodeId
  readonly prop?: doom.WriteKey
  readonly because?: string
}

export type Pushed =
  | { readonly ok: true; readonly once: string; readonly saved: Promise<void> }
  | { readonly ok: false; readonly refused: doom.Refusal }

export type Turned =
  | { readonly ok: true; readonly once: string; readonly saved: Promise<void> }
  | { readonly ok: false; readonly reason: "nothing" }
  | { readonly ok: false; readonly reason: "refused"; readonly refused: doom.Refusal }

export type TurnedRun = Turned | { readonly ok: false; readonly reason: "offline" }

export type Synced =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "offline" }
  | { readonly ok: false; readonly reason: "blocked"; readonly refusal: DoomRefusal["refusal"] }

export type DoomDeck = {
  readonly deck: DeckId
  view(): doom.Doom
  server(): doom.Doom
  pending(): readonly doom.Edit[]
  notices(): readonly Notice[]
  clearNotices(): void
  mint(): doom.NodeId
  push(writes: readonly doom.Write[], options?: { readonly author?: doom.Author }): Pushed
  undo(): Turned
  redo(): Turned
  undoRun(run: string): Promise<TurnedRun>
  sync(): Promise<Synced>
  catchUp(): Promise<{ readonly ok: boolean }>
  follow(signal: AbortSignal): Promise<void>
  reportPictures(rev: number, pictures: SlidePictures<doom.NodeId>): Promise<DoomPictured>
  picturesWanted(): boolean
  subscribe(listener: () => void): () => void
}

export type DoomOptions = {
  readonly once?: () => string
  readonly client?: string
  readonly storage?: DoomStorage
  readonly pause?: (ms: number) => Promise<void>
}

type Step = { readonly once: string; readonly before: doom.Doom; readonly writes: readonly doom.Write[] }

const retryMilliseconds = 2_000
const watchedRuns = 20

export type Opened = { readonly ok: true; readonly deck: DoomDeck } | Exclude<DoomRefusal, { readonly refusal: "edit" }>

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
  const kept = how === "open" ? await storage.read().catch(() => undefined) : undefined
  if (kept?.fold !== undefined)
    return { ok: true, deck: connected(remote, id.deck, kept.fold, kept.queue, storage, options) }
  const answer = await remote[how]({ deck: id.deck })
  if (!answer.ok) return answer.refusal === "edit" ? { ok: false, refusal: "payload" } : answer
  const queue = (await storage.read().catch(() => undefined))?.queue ?? []
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
  const turned: string[] = []
  let notices: readonly Notice[] = []
  const watched = new Map<string, { readonly before: doom.Doom; readonly edits: doom.Landed[] }>()
  let memo: { readonly server: doom.Doom; readonly queue: readonly Queued[]; readonly view: doom.Doom } | undefined
  let saving: Promise<void> = Promise.resolve()
  let running: Promise<Synced> | undefined
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
    saving = saving.then(() => storage.write(changed)).catch(() => undefined)
    return saving
  }

  function forget(gone: readonly string[]) {
    const out = (steps: Step[]) => steps.filter((step) => !gone.includes(step.once))
    undoSteps = out(undoSteps)
    redoSteps = out(redoSteps)
  }

  function drop(once: string, refusal: Pick<Notice, "refused" | "node" | "prop">) {
    const result = dropped(queue, once)
    if (result.gone.length === 0) return
    queue = result.queue
    notices = [
      ...notices,
      ...result.gone.map((name) =>
        name === once ? { once, ...refusal } : { once: name, refused: "stale" as const, because: once },
      ),
    ]
    forget(result.gone)
  }

  function settle() {
    for (const each of queue) {
      const at = server.onces.get(each.edit.once)
      if (at !== undefined) queue = landed(queue, each.edit.once, at)
    }
  }

  function watch(run: string | undefined, read: doom.Landed, before: doom.Doom) {
    if (run === undefined) return
    if (read.phase === "start") {
      watched.delete(run)
      watched.set(run, { before, edits: [] })
      const oldest = watched.keys().next().value
      if (watched.size > watchedRuns && oldest !== undefined) watched.delete(oldest)
    }
    watched.get(run)?.edits.push(read)
  }

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
      watch(read.author.run, read, next)
      next = result
    }
    if (next !== server) adopt(next)
    return true
  }

  async function catchUp(): Promise<{ readonly ok: boolean }> {
    const answer = await remote.since({ deck, rev: server.rev })
    if (!answer.ok) return { ok: false }
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

  async function drain(): Promise<Synced> {
    for (;;) {
      const head = queue[0]
      if (head === undefined) return { ok: true }
      const once = head.edit.once
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
          if (!result.ok && !wanted) break
        }
      } finally {
        running = undefined
      }
      return result
    })()
    running = run
    return run
  }

  function pushEdit(writes: readonly doom.Write[], by: doom.Author): Pushed & { readonly before?: doom.Doom } {
    const before = view()
    const edit: doom.Edit = { once: nextOnce(), author: by, writes }
    const made = queueEdit(server, queue, edit)
    if (doom.isRefusal(made)) return { ok: false, refused: made }
    const trial = appliedOn(before, made.edit)
    if (doom.isRefusal(trial)) return { ok: false, refused: trial }
    queue = [...queue, made]
    const saved = save({ queue })
    tell()
    void sync()
    return { ok: true, once: edit.once, saved, before }
  }

  function revOf(once: string): doom.Rev | undefined {
    const landedAt = server.onces.get(once)
    if (landedAt !== undefined) return landedAt
    for (const [at, name] of provisionalRevs(
      server,
      queue.map((each) => each.edit),
    ))
      if (name === once) return at
    return undefined
  }

  function turn(from: Step[], to: Step[]): Turned {
    const step = from.pop()
    if (step === undefined) return { ok: false, reason: "nothing" }
    const at = revOf(step.once)
    if (at === undefined) return { ok: false, reason: "nothing" }
    const now = view()
    const owned = new Set<doom.Rev>()
    for (const name of turned) {
      const turnedAt = revOf(name)
      if (turnedAt !== undefined) owned.add(turnedAt)
    }
    const writes = doom.invert(step.before, now, { once: step.once, author, writes: step.writes, rev: at }, owned)
    if (writes.length === 0) return { ok: false, reason: "nothing" }
    const pushed = pushEdit(writes, author)
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    to.push({ once: pushed.once, before: now, writes })
    turned.push(pushed.once)
    if (turned.length > 500) turned.shift()
    return { ok: true, once: pushed.once, saved: pushed.saved }
  }

  async function runInLog(run: string): Promise<{ before: doom.Doom; edits: doom.Landed[] } | undefined> {
    const answer = await remote.run?.({ deck, run })
    if (answer === undefined || !answer.ok || answer.edits.length === 0) return undefined
    const nodes = new Map<doom.NodeId, doom.Node>()
    for (const [name, raw] of Object.entries(answer.before)) {
      const stored = doom.readStoredNode(name, raw, {})
      if (stored === undefined) return undefined
      nodes.set(stored.node.id, stored.node)
    }
    const before: doom.Doom = { ...doom.emptyDoom, nodes }
    const known = new Map(nodes)
    const edits: doom.Landed[] = []
    for (const raw of answer.edits) {
      const read = doom.readLanded(raw, { ...before, nodes: known })
      if (doom.isRefusal(read)) return undefined
      for (const write of read.writes)
        if (write.prop === "type" && !known.has(write.node))
          known.set(write.node, { id: write.node, rev: read.rev, type: write.value } as doom.Node)
      edits.push(read)
    }
    return { before, edits }
  }

  async function undoRun(run: string): Promise<TurnedRun> {
    let found
    try {
      if (!(await catchUp()).ok) return { ok: false, reason: "offline" }
      const seen = watched.get(run)
      found = seen === undefined ? await runInLog(run) : { before: seen.before, edits: [...seen.edits] }
    } catch {
      return { ok: false, reason: "offline" }
    }
    const last = found?.edits.at(-1)
    if (found === undefined || last === undefined) return { ok: false, reason: "nothing" }
    const now = view()
    const owned = new Set<doom.Rev>(found.edits.map((each) => each.rev))
    for (const name of turned) {
      const turnedAt = revOf(name)
      if (turnedAt !== undefined) owned.add(turnedAt)
    }
    const writes = doom.invert(
      found.before,
      now,
      { once: last.once, author, writes: found.edits.flatMap((each) => each.writes), rev: last.rev },
      owned,
    )
    if (writes.length === 0) return { ok: false, reason: "nothing" }
    const pushed = pushEdit(writes, author)
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    redoSteps.push({ once: pushed.once, before: now, writes })
    turned.push(pushed.once)
    if (turned.length > 500) turned.shift()
    return { ok: true, once: pushed.once, saved: pushed.saved }
  }

  async function follow(signal: AbortSignal): Promise<void> {
    let wait = false
    while (!signal.aborted) {
      try {
        const answer = await remote.since(
          { deck, rev: server.rev, wait, ...(Date.now() < picturesUntil ? { pictures: true } : {}) },
          signal,
        )
        if (signal.aborted) return
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
        if (queue.length > 0) await sync()
      } catch {
        if (signal.aborted) return
        wait = false
        await pause(retryMilliseconds)
      }
    }
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
    mint: () => doom.nodeId(`${client}:${(counter += 1)}`),
    push(given, pushing) {
      const writes = [...given, ...doom.nameFromTitleWrites(view(), given)]
      const pushed = pushEdit(writes, pushing?.author ?? author)
      if (!pushed.ok) return pushed
      undoSteps.push({ once: pushed.once, before: pushed.before!, writes })
      redoSteps = []
      return { ok: true, once: pushed.once, saved: pushed.saved }
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
