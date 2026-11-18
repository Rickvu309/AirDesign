import { authorableValue, authorableSlide } from "@airdesign/catalog"
import { readDeckId, type DeckId, type WireRefusal } from "@airdesign/catalog"
import {
  currentBox,
  currentValue,
  limits,
  readBox,
  readElementId,
  readRow,
  refusals,
  readSlideState,
  storedValue,
  unsent,
  type Box,
  type DeckIndex,
  type ElementId,
  type SlideCommand,
  type SlideId,
  type Row,
  type Value,
} from "@airdesign/document"
import type { CommitResult, OpenResult, Remote, WatchResult } from "./remote.js"
import { indexedGridOpening } from "./grid-opening.js"
import { queueIndex, sendIndex } from "./deck-index.js"
import { accountKey, markNewer, storeNewer } from "./device.js"
import { rowsFromRegister, view, type DeckView, type LivePhase } from "./deck-view.js"
import { slideBatch, slideChange, valueChange, type Enqueued } from "./deck-edit.js"
import {
  adoptRows,
  confirmRows,
  editHeld,
  heldView,
  sealRows,
  setAside,
  takeAside,
  takeEdits,
  unsealRows,
} from "./held.js"
import { bodyBytes, nextBatch, wireOf } from "./commit-body.js"
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
import { fitConfirmed, rowKey, type ConfirmedRow, type PendingRow, type StoredRow } from "./store.js"

export type { LivePhase } from "./deck-view.js"

export type OpenDeckResult = ({ ok: true } & DeckView) | { ok: false; readonly refusal: WireRefusal }

export type FollowResult =
  | { ok: true; readonly deck: DeckId; readonly revision: number; readonly changed: boolean }
  | Extract<WatchResult, { ok: false }>

export type FlushResult = CommitResult & { readonly aside?: number; readonly asideTooLarge?: number }

export type EnqueueResult<Painted = string> =
  | { ok: true; readonly painted: Painted }
  | { ok: false; readonly refusal: WireRefusal }

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

function heard<Answer extends OpenResult | CommitResult>(answer: Answer): Answer {
  if (!answer.ok && answer.refusal === "newer") markNewer()
  return answer
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
    const sending = [...unsent(held.pending, 0)]
    let result: CommitResult = { ok: false, refusal: "batch" }
    for (let start = 0; start < sending.length;) {
      const first = sending[start]
      if (first === undefined) break
      const once = first.once ?? nextOnce()
      const planned = nextBatch(deck, sending.slice(start), once)
      const keys = planned.map((row) => rowKey(deck, "pending", row.order))
      const rowsInBatch = await sealRows(deck, keys, once)
      if (rowsInBatch.length === 0) return result
      result = heard(await remote.commit({ deck, batch: rowsInBatch.map(wireOf), once }))
      if (!result.ok && result.refusal === "size" && bodyBytes(deck, rowsInBatch, once) > limits.body) {
        if (rowsInBatch.length === 1) {
          await setAside(deck, rowsInBatch, true)
          start += 1
          continue
        }
        await unsealRows(deck, keys, once)
        sending.splice(start, rowsInBatch.length, ...rowsInBatch.map(({ once: _sealed, ...open }) => open))
        continue
      }
      if (!result.ok) return result
      if (result.deck !== deck || result.key !== `${deck}:${result.revision}`) {
        return { ok: false, refusal: "payload" }
      }
      start += rowsInBatch.length
      const stored: ConfirmedRow[] = []
      let revision = 0
      for (const row of rowsInBatch) {
        if (row.slideEdit !== undefined && row.slideFile !== undefined) {
          stored.push({
            kind: "confirmed",
            deck,
            revision,
            value: "",
            slideFile: row.slideFile,
            slideEdit: row.slideEdit,
            ...(row.format === undefined ? {} : { format: row.format }),
          })
          revision += 1
          continue
        }
        revision = fitConfirmed(deck, revision, row, row.node, stored, row.floor)
      }
      const sent = rowsInBatch.map((row) => rowKey(deck, "pending", row.order))
      await confirmRows(deck, result.revision, stored, sent)
      if (takeEdits(deck, rowsInBatch) && known.get(deck) === result.revision - 1) known.set(deck, result.revision)
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
    const index = await sendIndex(remote, deck, () => openOnce(deck))
    if (index?.ok === false) return index
    let held = await heldView(deck)
    if (index?.indexedSections) {
      const opened = await openOnce(deck)
      if (opened.ok && (index.revision > opened.revision || held?.register.sectionStarts === undefined)) {
        const refreshed = await refresh(deck)
        if (!refreshed.ok) return refreshed
        held = await heldView(deck)
      }
    }
    if (!held?.pending.length) {
      if (index === null) return { ok: false, refusal: "batch" }
      const { indexedSections: _indexedSections, ...result } = index
      return result
    }
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
    if (accountKey() !== undefined)
      await adoptRows(
        deck,
        opened.revision,
        rowsFromRegister(deck, opened.register),
        indexedGridOpening(opened.register.index),
      )
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
    return editHeld<Enqueued>(deck, (held) => {
      if (replaying !== undefined && !holdsUnsaved(shelf, account, deck, replaying))
        return { puts: [], result: { ok: true, body: undefined } }
      return valueChange(deck, held, edit, named, floor)
    })
  }

  function writeSlide(deck: DeckId, kept: Extract<Kept, { kind: "slide" | "slides" }>, id?: string, replay = false) {
    const account = accountKey()
    if (account === undefined) return Promise.resolve(signedOut)
    return editHeld<EnqueueResult<readonly string[]>>(deck, (held) => {
      if (
        replay &&
        id !== undefined &&
        (!holdsUnsaved(shelf, account, deck, id) || held.pending.some((row) => row.once === id))
      )
        return { puts: [], result: { ok: true, painted: [] } }
      return kept.kind === "slide"
        ? slideChange(deck, held, kept.file, kept.edit)
        : slideBatch(deck, held, kept.file, kept.edits, id ?? nextOnce())
    })
  }

  function replayUnsaved(deck: DeckId, entry: Unsaved): Promise<unknown> {
    if (entry.kind === "slide" || entry.kind === "slides") return writeSlide(deck, entry, entry.id, true)
    const node = readElementId(entry.node)
    if (node === undefined) return Promise.resolve()
    if (entry.kind === "text") return writeValue(deck, { value: entry.value }, node, entry.floor, entry.id)
    if (entry.kind === "row") return writeValue(deck, storedValue(entry.row), node, entry.floor, entry.id)
    return writeValue(deck, { property: "box", value: entry.box }, node, entry.floor, entry.id)
  }

  async function keepAndWrite<Result>(
    deck: DeckId,
    kept: Kept,
    write: (entry: string) => Promise<Result>,
  ): Promise<Result> {
    const account = accountKey()
    const entry = nextEntry()
    if (account === undefined) return write(entry)
    const waiting = recovered(deck)
    keepUnsaved(shelf, account, deck, entry, kept)
    await waiting
    const result = await write(entry)
    releaseUnsaved(shelf, account, deck, entry)
    return result
  }

  function enqueueValue(deck: string, edit: Value, node: ElementId, floor: string): Promise<Enqueued> {
    if (!authorableValue(edit)) return Promise.resolve({ ok: false, refusal: "field" })
    const parsed = readDeckId(deck)
    if (!parsed.ok) return Promise.resolve({ ok: false, refusal: "deck" })
    const named = readElementId(node)
    if (named === undefined) return Promise.resolve({ ok: false, refusal: "dead" })
    const kept: Kept =
      edit.v !== undefined
        ? { kind: "row", node: named, floor, row: { v: edit.v, patch: edit.patch } }
        : edit.property === "box"
          ? { kind: "box", node: named, floor, box: edit.value }
          : { kind: "text", node: named, floor, value: edit.value }
    return keepAndWrite(parsed.deck, kept, () => writeValue(parsed.deck, edit, named, floor))
  }

  function enqueueSlides(
    deck: string,
    file: readonly SlideId[],
    edits: readonly SlideCommand[],
  ): Promise<EnqueueResult<readonly string[]>> {
    return unlessNewer(async () => {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      const state = readSlideState({ file, order: edits })
      const first = state?.order[0]
      if (state === undefined || first === undefined || !state.order.every(authorableSlide))
        return { ok: false, refusal: "field" }
      const kept: Kept =
        state.order.length === 1
          ? { kind: "slide", file: state.file, edit: first }
          : { kind: "slides", file: state.file, edits: state.order }
      return keepAndWrite(parsed.deck, kept, (id) => writeSlide(parsed.deck, kept, id))
    })
  }

  return {
    index: (deck: string, index: Parameters<typeof queueIndex>[1], fresh = false) =>
      queueIndex(deck, index, nextOnce, fresh),
    enqueueSlide: (deck: string, file: readonly SlideId[], edit: SlideCommand) => enqueueSlides(deck, file, [edit]),
    enqueueSlides,
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
    enqueueRow(deck: string, row: Row, node: ElementId, floor: string): Promise<EnqueueResult<Row>> {
      return unlessNewer(async () => {
        const read = readRow(row, "text")
        if (!read.ok) return { ok: false, refusal: "field" }
        const result = await enqueueValue(deck, { v: read.value.v, patch: read.value.patch }, node, floor)
        return result.ok ? { ok: true, painted: read.value } : result
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
          const { aside, tooLarge } = await takeAside(parsed.deck)
          if (aside === 0) return result
          return tooLarge === 0 ? { ...result, aside } : { ...result, aside, asideTooLarge: tooLarge }
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
        if (
          held !== null &&
          (held.confirmed.length > 0 || held.pending.length > 0 || held.register.sectionStarts !== undefined)
        ) {
          if (known.has(parsed.deck) || !openingDecks.has(parsed.deck)) return { ok: true, ...held }
          await serial(parsed.deck, () => adoptOpening(parsed.deck))
          const adopted = await readRecovered(parsed.deck)
          return adopted === null ? signedOut : { ok: true, ...adopted }
        }
        const opened = await openOnce(parsed.deck)
        if (!opened.ok) return opened
        const confirmed = rowsFromRegister(parsed.deck, opened.register)
        const opening = indexedGridOpening(opened.register.index)
        const adopted = await adoptRows(parsed.deck, opened.revision, confirmed, opening)
        if (!known.has(parsed.deck)) known.set(parsed.deck, opened.revision)
        if (adopted) return { ok: true, ...view(parsed.deck, confirmed, opening) }
        const newer = await readRecovered(parsed.deck)
        return newer === null ? signedOut : { ok: true, ...newer }
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
