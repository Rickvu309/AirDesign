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
import { statusOf, type DeckStatus, type Reach } from "./doom-status.js"
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

export type TurnedRun =
  | { readonly ok: true; readonly once: string; readonly saved: Promise<void>; readonly kept: readonly doom.NodeId[] }
  | Exclude<Turned, { readonly ok: true }>
  | { readonly ok: false; readonly reason: "offline" }

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
  status(): DeckStatus
  mint(): doom.NodeId
  push(writes: readonly doom.Write[], options?: { readonly author?: doom.Author; readonly step?: string }): Pushed
  undo(): Turned
  redo(): Turned
  undoRun(run: string): Promise<TurnedRun>
  sync(): Promise<Synced>
  catchUp(): Promise<{ readonly ok: boolean }>
  follow(signal: AbortSignal): Promise<Followed>
  reportPictures(rev: number, pictures: SlidePictures<doom.NodeId>): Promise<DoomPictured>
  picturesWanted(): boolean
  subscribe(listener: () => void): () => void
}

export type Followed = "stopped" | "gone"

export type DoomOptions = {
  readonly once?: () => string
  readonly client?: string
  readonly storage?: DoomStorage
  readonly pause?: (ms: number) => Promise<void>
}

type Step = {
  readonly onces: readonly string[]
  readonly before: doom.Doom
  readonly writes: readonly doom.Write[]
  readonly key?: string
}

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
  const turned: string[] = []
  let notices: readonly Notice[] = []
  let link: Reach = "reached"
  let kept = true
  let shownStatus: DeckStatus = { kind: "saved" }
  const watched = new Map<string, doom.RunEdit[]>()
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
    const named = new Set(queue.flatMap((each) => [each.edit.once, ...each.after]))
    for (const once of named) {
      const at = once === null ? undefined : server.onces.get(once)
      if (at !== undefined) queue = landed(queue, once!, at)
    }
  }
  settle()

  function watch(run: string | undefined, read: doom.Landed, before: doom.Doom) {
    if (run === undefined) return
    if (read.phase === "start") {
      watched.delete(run)
      watched.set(run, [])
      const oldest = watched.keys().next().value
      if (watched.size > watchedRuns && oldest !== undefined) watched.delete(oldest)
    }
    watched.get(run)?.push({ ...read, replaced: doom.replacedBy(before, read) })
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

  async function drain(): Promise<Synced> {
    for (;;) {
      const head = queue[0]
      if (head === undefined) return { ok: true }
      const once = head.edit.once
      const built = head.after.find((name) => name !== null)
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
    const step = from.at(-1)
    const last = step?.onces.at(-1)
    if (step === undefined || last === undefined) return { ok: false, reason: "nothing" }
    const at = revOf(last)
    if (at === undefined) {
      from.pop()
      return { ok: false, reason: "nothing" }
    }
    const now = view()
    const owned = new Set<doom.Rev>()
    for (const name of [...turned, ...step.onces]) {
      const turnedAt = revOf(name)
      if (turnedAt !== undefined) owned.add(turnedAt)
    }
    const writes = doom.invert(step.before, now, { once: last, author, writes: step.writes, rev: at }, owned)
    if (writes.length === 0) {
      from.pop()
      return { ok: false, reason: "nothing" }
    }
    const pushed = pushEdit(writes, author)
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    from.pop()
    to.push({ onces: [pushed.once], before: now, writes })
    turned.push(pushed.once)
    if (turned.length > 500) turned.shift()
    return { ok: true, once: pushed.once, saved: pushed.saved }
  }

  async function runInLog(run: string): Promise<doom.RunEdit[] | undefined> {
    const answer = await remote.run?.({ deck, run })
    if (answer === undefined || !answer.ok || answer.edits.length === 0) return undefined
    const known = new Map(view().nodes)
    const edits: doom.RunEdit[] = []
    for (const [index, raw] of answer.edits.entries()) {
      const read = doom.readRunEdit(raw, answer.replaced[index], { ...view(), nodes: known })
      if (doom.isRefusal(read)) return undefined
      for (const write of read.writes)
        if (write.prop === "type" && !known.has(write.node))
          known.set(write.node, { id: write.node, rev: read.rev, type: write.value } as doom.Node)
      edits.push(read)
    }
    return edits
  }

  async function undoRun(run: string): Promise<TurnedRun> {
    let edits
    try {
      if (!(await catchUp()).ok) return { ok: false, reason: "offline" }
      edits = watched.get(run) ?? (await runInLog(run))
    } catch {
      return { ok: false, reason: "offline" }
    }
    if (edits === undefined || edits.length === 0) return { ok: false, reason: "nothing" }
    const now = view()
    const owned = new Set<doom.Rev>()
    for (const name of turned) {
      const turnedAt = revOf(name)
      if (turnedAt !== undefined) owned.add(turnedAt)
    }
    const { writes, kept } = doom.invertRun(now, edits, owned)
    if (writes.length === 0) return { ok: false, reason: "nothing" }
    const pushed = pushEdit(writes, author)
    if (!pushed.ok) return { ok: false, reason: "refused", refused: pushed.refused }
    redoSteps.push({ onces: [pushed.once], before: now, writes })
    turned.push(pushed.once)
    if (turned.length > 500) turned.shift()
    return { ok: true, once: pushed.once, saved: pushed.saved, kept }
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
        if (queue.length > 0 && !(await sync()).ok) {
          wait = false
          await pause(retryMilliseconds)
        }
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
    push(given, pushing) {
      const writes = [...given, ...doom.nameFromTitleWrites(view(), given)]
      const pushed = pushEdit(writes, pushing?.author ?? author)
      if (!pushed.ok) return pushed
      const open = undoSteps.at(-1)
      if (pushing?.step !== undefined && open?.key === pushing.step && redoSteps.length === 0)
        undoSteps[undoSteps.length - 1] = {
          ...open,
          onces: [...open.onces, pushed.once],
          writes: [...open.writes, ...writes],
        }
      else
        undoSteps.push({
          onces: [pushed.once],
          before: pushed.before!,
          writes,
          ...(pushing?.step === undefined ? {} : { key: pushing.step }),
        })
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
