import { readDeckId, type DeckId, type WireEdit, type WireSlide, type WireRefusal } from "@airdesign/catalog"
import {
  currentBox,
  currentValue,
  limits,
  readBox,
  readElementId,
  refusals,
  readSlideState,
  storedValue,
  unsent,
  type Box,
  type DeckIndex,
  type ElementId,
  type SlideCommand,
  type SlideId,
  type Value,
} from "@airdesign/document"
import type { CommitResult, OpenResult, Remote, WatchResult } from "./remote.js"
import { queueIndex, sendIndex } from "./deck-index.js"
import { accountKey, markNewer, storeNewer } from "./device.js"
import { rowsFromRegister, view, type DeckView, type LivePhase } from "./deck-view.js"
import { slideChange, valueChange, type Enqueued } from "./deck-edit.js"
import { changeHeld, heldView, sealRows, setAside, takeAside, writeDeckRows } from "./held.js"
import { refusedRows } from "./slide-replay.js"
import { idleDays, markSeen, sweepIdle } from "./device-sweep.js"
import {
  holdsUnsaved,
  journalDecks,
  keepUnsaved,
  pageShelf,
  recoverUnsaved,
  releaseUnsaved,
  type Kept,
  type Shelf,
  type Unsaved,
} from "./unsaved.js"
import {
  fitConfirmed,
  isConfirmed,
  readRows,
  rowKey,
  type ConfirmedRow,
  type PendingRow,
  type StoredRow,
} from "./store.js"

export type { LivePhase } from "./deck-view.js"

export type OpenDeckResult = ({ ok: true } & DeckView) | { ok: false; readonly refusal: WireRefusal }

export type FollowResult =
  | { ok: true; readonly deck: DeckId; readonly revision: number; readonly changed: boolean }
  | Extract<WatchResult, { ok: false }>

export type FlushResult = CommitResult & { readonly aside?: number }

export type EnqueueResult<Painted = string> =
  | { ok: true; readonly painted: Painted }
  | { ok: false; readonly refusal: WireRefusal }

function wireOf(row: PendingRow): WireEdit | WireSlide {
  if (row.slideEdit !== undefined && row.slideFile !== undefined) return { ...row.slideEdit, file: row.slideFile }
  if (row.node === undefined) throw new Error("missing node")
  if (row.floor === undefined) return { ...storedValue(row), node: row.node }
  return { ...storedValue(row), node: row.node, floor: row.floor }
}

const flushing = new Map<string, Promise<unknown>>()
type OpenOnceResult = { ok: true; index?: DeckIndex } | Extract<OpenResult, { ok: false }>

const openingByRemote = new WeakMap<Remote, Map<DeckId, Promise<OpenResult>>>()
const knownByRemote = new WeakMap<Remote, Map<DeckId, number>>()

function serial<T>(deck: DeckId, work: () => Promise<T>): Promise<T> {
  const lane = `${accountKey() ?? ""}\u0005${deck}`
  const before = flushing.get(lane) ?? Promise.resolve()
  const run = before.then(
    () => work(),
    () => work(),
  )
  flushing.set(lane, run)
  return run
}

const signedOut = { ok: false, refusal: "session" } as const

const newer = { ok: false, refusal: "newer" } as const

async function unlessNewer<Result>(work: () => Promise<Result>): Promise<Result | typeof newer> {
  if (storeNewer()) return newer
  try {
    return await work()
  } catch (error) {
    if (storeNewer()) return newer
    throw error
  }
}

function heard<Answer extends OpenResult>(opened: Answer): Answer {
  if (!opened.ok && opened.refusal === "newer") markNewer()
  return opened
}

const decided: ReadonlySet<string> = new Set(refusals)

type Options = {
  readonly once?: () => string
  readonly entry?: () => string
  readonly shelf?: Shelf
  readonly now?: () => number
}

export function connect(remote: Remote, options: Options = {}) {
  const nextOnce = (options.once ?? crypto.randomUUID).bind(crypto)
  const nextEntry = (options.entry ?? crypto.randomUUID).bind(crypto)
  const now = options.now ?? Date.now
  const shelf = options.shelf ?? pageShelf()
  const openingDecks = openingByRemote.get(remote) ?? new Map<DeckId, Promise<OpenResult>>()
  openingByRemote.set(remote, openingDecks)
  const known = knownByRemote.get(remote) ?? new Map<DeckId, number>()
  knownByRemote.set(remote, known)

  function forget(deck: DeckId, opening: Promise<OpenResult>) {
    if (openingDecks.get(deck) === opening) openingDecks.delete(deck)
  }

  function openOnce(deck: DeckId): Promise<OpenResult> {
    const known = openingDecks.get(deck)
    if (known !== undefined) return known
    const opening: Promise<OpenResult> = remote.open({ deck }).then(
      (opened) => {
        if (!opened.ok) forget(deck, opening)
        return heard(opened)
      },
      (error: unknown) => {
        forget(deck, opening)
        throw error
      },
    )
    openingDecks.set(deck, opening)
    return opening
  }

  async function sendBatches(deck: DeckId, held: DeckView): Promise<CommitResult> {
    const sending = unsent(held.pending, 0)
    let revision = held.confirmed.reduce((max, row) => Math.max(max, row.revision + 1), 0)
    let result: CommitResult = { ok: false, refusal: "batch" }
    for (let start = 0; start < sending.length;) {
      const first = sending[start]
      if (first === undefined) break
      const planned: PendingRow[] = []
      for (const row of sending.slice(start, start + limits.batch)) {
        if (row.once !== first.once) break
        planned.push(row)
      }
      const once = first.once ?? nextOnce()
      const rowsInBatch = await sealRows(
        deck,
        planned.map((row) => rowKey(deck, "pending", row.order)),
        once,
      )
      if (rowsInBatch.length === 0) return result
      result = await remote.commit({ deck, batch: rowsInBatch.map(wireOf), once })
      if (!result.ok) return result
      if (result.deck !== deck || result.key !== `${deck}:${result.revision}`) {
        return { ok: false, refusal: "payload" }
      }
      const sent = rowsInBatch.map((row) => rowKey(deck, "pending", row.order))
      const mirror = known.get(deck)
      start += rowsInBatch.length
      if (mirror !== undefined && result.revision <= mirror) {
        await writeDeckRows(deck, [], sent, "stale")
        continue
      }
      if (mirror === result.revision - 1) known.set(deck, result.revision)
      const stored: ConfirmedRow[] = []
      for (const row of rowsInBatch) {
        if (row.slideEdit !== undefined && row.slideFile !== undefined) {
          stored.push({
            kind: "confirmed",
            deck,
            revision,
            value: "",
            slideFile: row.slideFile,
            slideEdit: row.slideEdit,
          })
          revision += 1
          continue
        }
        revision = fitConfirmed(deck, revision, row, row.node, stored)
      }
      await writeDeckRows(
        deck,
        stored.map((row) => ({ key: rowKey(deck, "confirmed", row.revision), row })),
        sent,
        "same",
      )
    }
    return result
  }

  async function asideRefused(deck: DeckId): Promise<boolean> {
    const opened = await refresh(deck)
    if (!opened.ok) return false
    const held = await heldView(deck)
    if (held === null) return false
    const refused = refusedRows(opened.register, held.pending)
    await setAside(deck, refused)
    return refused.length > 0
  }

  async function sendRows(deck: DeckId): Promise<CommitResult> {
    const indexed = await sendIndex(remote, deck, () => openOnce(deck))
    if (indexed !== null && !indexed.ok) return indexed
    const held = await heldView(deck)
    if (held === null || held.pending.length === 0) return indexed ?? { ok: false, refusal: "batch" }
    const opened = await openOnce(deck)
    if (!opened.ok) return opened
    const adopting = !known.has(deck)
    if (adopting) await adopt(deck, opened)
    let view = adopting ? ((await heldView(deck)) ?? held) : held
    for (;;) {
      const result = await sendBatches(deck, view)
      if (result.ok || !decided.has(result.refusal) || !(await asideRefused(deck))) return result
      const next = await heldView(deck)
      if (next === null || next.pending.length === 0) return result
      view = next
    }
  }

  async function refresh(deck: DeckId): Promise<OpenResult> {
    const opened = heard(await remote.open({ deck }))
    if (!opened.ok) return opened
    await adopt(deck, opened)
    return opened
  }

  async function adopt(deck: DeckId, opened: Extract<OpenResult, { ok: true }>): Promise<void> {
    if (accountKey() !== undefined) {
      const confirmed = rowsFromRegister(deck, opened.register)
      const existing = await readRows(deck)
      await writeDeckRows(
        deck,
        confirmed.map((row) => ({ key: rowKey(deck, "confirmed", row.revision), row })),
        existing.filter(isConfirmed).map((row) => rowKey(deck, "confirmed", row.revision)),
        "stale",
      )
    }
    openingDecks.set(deck, Promise.resolve(opened))
    known.set(deck, opened.revision)
  }

  async function adoptOpening(deck: DeckId): Promise<void> {
    const opening = known.has(deck) ? undefined : openingDecks.get(deck)
    if (opening === undefined) return
    const opened = await opening
    if (opened.ok && !known.has(deck)) await adopt(deck, opened)
  }

  const recovered = (deck: DeckId) => {
    const account = accountKey()
    if (account === undefined) return Promise.resolve()
    return recoverUnsaved(shelf, account, deck, (entry) => replayUnsaved(deck, entry))
  }

  async function readRecovered(deck: DeckId): Promise<DeckView | null> {
    if (accountKey() === undefined) return null
    await recovered(deck)
    return heldView(deck)
  }

  function writeValue(
    deck: DeckId,
    edit: Value,
    named: ElementId,
    floor: string,
    replaying?: string,
  ): Promise<Enqueued> {
    const account = accountKey()
    if (account === undefined) return Promise.resolve(signedOut)
    return changeHeld<Enqueued>(deck, (held) => {
      if (replaying !== undefined && !holdsUnsaved(shelf, account, deck, replaying))
        return { puts: [], result: { ok: true, body: undefined } }
      return valueChange(deck, held, edit, named, floor)
    })
  }

  function writeSlide(
    deck: DeckId,
    file: readonly SlideId[],
    command: SlideCommand,
    replaying?: string,
  ): Promise<EnqueueResult<readonly string[]>> {
    const account = accountKey()
    if (account === undefined) return Promise.resolve(signedOut)
    return changeHeld<EnqueueResult<readonly string[]>>(deck, (held) => {
      if (replaying !== undefined && !holdsUnsaved(shelf, account, deck, replaying))
        return { puts: [], result: { ok: true, painted: [] } }
      return slideChange(deck, held, file, command)
    })
  }

  function replayUnsaved(deck: DeckId, entry: Unsaved): Promise<unknown> {
    if (entry.kind === "slide") return writeSlide(deck, entry.file, entry.edit, entry.id)
    const node = readElementId(entry.node)
    if (node === undefined) return Promise.resolve()
    if (entry.kind === "text") return writeValue(deck, { value: entry.value }, node, entry.floor, entry.id)
    const box = readBox(entry.box)
    if (box === null) return Promise.resolve()
    return writeValue(deck, { property: "box", value: box }, node, entry.floor, entry.id)
  }

  async function keepAndWrite<Result>(deck: DeckId, kept: Kept, write: () => Promise<Result>): Promise<Result> {
    const account = accountKey()
    if (account === undefined) return write()
    const waiting = recovered(deck)
    const entry = nextEntry()
    keepUnsaved(shelf, account, deck, entry, kept)
    await waiting
    const result = await write()
    releaseUnsaved(shelf, account, deck, entry)
    return result
  }

  function enqueueValue(deck: string, edit: Value, node: ElementId, floor: string): Promise<Enqueued> {
    const parsed = readDeckId(deck)
    if (!parsed.ok) return Promise.resolve({ ok: false, refusal: "deck" })
    const named = readElementId(node)
    if (named === undefined) return Promise.resolve({ ok: false, refusal: "dead" })
    const kept: Kept =
      edit.property === "box"
        ? { kind: "box", node: named, floor, box: edit.value }
        : { kind: "text", node: named, floor, value: edit.value }
    return keepAndWrite(parsed.deck, kept, () => writeValue(parsed.deck, edit, named, floor))
  }

  return {
    index: (deck: string, index: Parameters<typeof queueIndex>[1]) => queueIndex(deck, index, nextOnce),
    enqueueSlide(
      deck: string,
      file: readonly SlideId[],
      edit: SlideCommand,
    ): Promise<EnqueueResult<readonly string[]>> {
      return unlessNewer(async () => {
        const parsed = readDeckId(deck)
        if (!parsed.ok) return parsed
        const state = readSlideState({ file, order: [edit] })
        const command = state?.order[0]
        if (state === undefined || command === undefined) return { ok: false, refusal: "field" }
        return keepAndWrite(parsed.deck, { kind: "slide", file: state.file, edit: command }, () =>
          writeSlide(parsed.deck, state.file, command),
        )
      })
    },
    enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<EnqueueResult> {
      return unlessNewer(async () => {
        const result = await enqueueValue(deck, { value }, node, floor)
        if (!result.ok) return result
        return { ok: true, painted: result.body === undefined ? value : currentValue(result.body) }
      })
    },
    enqueueBox(deck: string, box: Box, node: ElementId, floor: string): Promise<EnqueueResult<Box>> {
      return unlessNewer(async () => {
        const read = readBox(box)
        if (read === null) return { ok: false, refusal: "field" }
        const result = await enqueueValue(deck, { property: "box", value: read }, node, floor)
        if (!result.ok) return result
        return { ok: true, painted: (result.body === undefined ? null : currentBox(result.body)) ?? read }
      })
    },
    open(deck: string): Promise<OpenOnceResult> {
      return unlessNewer(async () => {
        const parsed = readDeckId(deck)
        if (!parsed.ok) return parsed
        const opened = await openOnce(parsed.deck)
        if (!opened.ok) return opened
        return opened.register.index === undefined ? { ok: true } : { ok: true, index: opened.register.index }
      })
    },
    flush(deck: string): Promise<FlushResult> {
      return unlessNewer(async () => {
        const parsed = readDeckId(deck)
        if (!parsed.ok) return { ok: false, refusal: "deck" }
        if (accountKey() === undefined) return signedOut
        await recovered(parsed.deck)
        return serial(parsed.deck, async () => {
          const result = await sendRows(parsed.deck)
          const aside = await takeAside(parsed.deck)
          return aside === 0 ? result : { ...result, aside }
        })
      })
    },
    openDeck(deck: string): Promise<OpenDeckResult> {
      return unlessNewer(async () => {
        const parsed = readDeckId(deck)
        if (!parsed.ok) return parsed
        if (accountKey() === undefined) return signedOut
        const held = await readRecovered(parsed.deck)
        await markSeen(parsed.deck, now())
        if (held !== null && (held.confirmed.length > 0 || held.pending.length > 0)) {
          if (known.has(parsed.deck) || !openingDecks.has(parsed.deck)) return { ok: true, ...held }
          await serial(parsed.deck, () => adoptOpening(parsed.deck))
          const adopted = await readRecovered(parsed.deck)
          return adopted === null ? signedOut : { ok: true, ...adopted }
        }
        const opened = await openOnce(parsed.deck)
        if (!opened.ok) return opened
        const confirmed = rowsFromRegister(parsed.deck, opened.register)
        await writeDeckRows(
          parsed.deck,
          confirmed.map((row) => ({ key: rowKey(parsed.deck, "confirmed", row.revision), row })),
          [],
          "stale",
        )
        if (!known.has(parsed.deck)) known.set(parsed.deck, opened.revision)
        return { ok: true, ...view(parsed.deck, confirmed) }
      })
    },
    async phase(deck: string): Promise<LivePhase> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return "confirmed"
      return (await readRecovered(parsed.deck))?.phase ?? "confirmed"
    },
    async pending(deck: string): Promise<readonly PendingRow[]> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return []
      return (await readRecovered(parsed.deck))?.pending ?? []
    },
    async rows(deck: string): Promise<readonly StoredRow[]> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return []
      const held = await readRecovered(parsed.deck)
      return held === null ? [] : [...held.confirmed, ...held.pending]
    },
    watch(deck: string, cursor: number | null): Promise<WatchResult> {
      return unlessNewer(async () => {
        const parsed = readDeckId(deck)
        if (!parsed.ok) return parsed
        const watched = await remote.watch({ deck: parsed.deck, cursor })
        if (!watched.ok) return watched
        if (cursor === null || watched.revision > cursor) await serial(parsed.deck, () => refresh(parsed.deck))
        return watched
      })
    },
    follow(deck: string): Promise<FollowResult> {
      return unlessNewer(async () => {
        const parsed = readDeckId(deck)
        if (!parsed.ok) return parsed
        const watched = await remote.watch({ deck: parsed.deck, cursor: known.get(parsed.deck) ?? null })
        if (!watched.ok) return watched
        return serial(parsed.deck, async (): Promise<FollowResult> => {
          if (watched.revision <= (known.get(parsed.deck) ?? -1)) return { ...watched, changed: false }
          const opened = await refresh(parsed.deck)
          if (!opened.ok) return opened
          return { ok: true, deck: opened.deck, revision: opened.revision, changed: true }
        })
      })
    },
    async sweep(): Promise<readonly string[]> {
      const account = accountKey()
      if (account === undefined) return []
      for (const deck of journalDecks(shelf, account)) {
        const parsed = readDeckId(deck)
        if (parsed.ok) await recovered(parsed.deck)
      }
      const journaled = new Set(journalDecks(shelf, account))
      return sweepIdle(now(), idleDays, (deck) => journaled.has(deck))
    },
  }
}
