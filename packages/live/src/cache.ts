import { readDeckId, type DeckId, type WireEdit, type WireSlide, type WireRefusal } from "@airdesign/catalog"
import {
  currentBox,
  currentValue,
  decide,
  legacyElement,
  limits,
  openRegister,
  presentSlides,
  readBox,
  readElementId,
  readSlideState,
  replay,
  rootElement,
  storedValue,
  unsent,
  valueBytes,
  version,
  type Box,
  type ElementId,
  type NodeRegister,
  type Queued,
  type Register,
  type SlideCommand,
  type SlideId,
  type Value,
} from "@airdesign/document"
import type { CommitResult, OpenResult, Remote, WatchResult } from "./remote.js"
import { hasLayouts, queueIndex, sendIndex } from "./deck-index.js"
import { withSlides } from "./slide-replay.js"
import {
  changeRows,
  fitConfirmed,
  isConfirmed,
  isPending,
  logicalValues,
  pendingRow,
  readRows,
  rowKey,
  writeRows,
  type ConfirmedRow,
  type PendingRow,
  type StoredRow,
} from "./store.js"

export type LivePhase = "on-device" | "confirmed"

export type OpenDeckResult =
  | {
      ok: true
      readonly register: Register
      readonly phase: LivePhase
      readonly pending: readonly PendingRow[]
      readonly confirmed: readonly ConfirmedRow[]
    }
  | { ok: false; readonly refusal: WireRefusal }

export type FollowResult =
  | { ok: true; readonly deck: DeckId; readonly revision: number; readonly changed: boolean }
  | Extract<WatchResult, { ok: false }>

export type EnqueueResult<Painted = string> =
  | { ok: true; readonly painted: Painted }
  | { ok: false; readonly refusal: WireRefusal }

function rowsFromRegister(deck: DeckId, register: Register): ConfirmedRow[] {
  const into: ConfirmedRow[] = []
  let revision = 0
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body === undefined) continue
    const node = id === rootElement ? undefined : id
    for (const landed of body.landed) {
      if (!landed.visible) continue
      revision = fitConfirmed(deck, revision, landed, node, into)
    }
  }
  for (const edit of register.order) {
    into.push({ kind: "confirmed", deck, revision, value: "", slideFile: register.file, slideEdit: edit })
    revision += 1
  }
  return into
}

type WiredRow = PendingRow & { readonly node: ElementId }

type Enqueued = { ok: true; readonly body: NodeRegister | undefined } | { ok: false; readonly refusal: WireRefusal }

function wired(row: PendingRow): row is WiredRow {
  return readElementId(row.node) !== undefined
}

function opened(register: Register, node: ElementId | undefined, floor: string): Register {
  if (node === undefined || register.nodes.includes(node)) return register
  const decision = decide(register, { command: "add", node, floor, route: register.route })
  return decision.decision === "apply" ? decision.register : register
}

function played(deck: DeckId, confirmed: readonly ConfirmedRow[], pending: readonly PendingRow[]): Register {
  let register = openRegister("", deck)
  const versions = new Map<string, number>()
  const seeded: Queued[] = []
  for (const row of logicalValues(confirmed)) {
    register = opened(register, row.node, "")
    if (row.node !== undefined && !register.nodes.includes(row.node)) continue
    const base = versions.get(row.node ?? "") ?? 0
    versions.set(row.node ?? "", base + 1)
    seeded.push(row.node === undefined ? { base, ...storedValue(row) } : { base, ...storedValue(row), node: row.node })
  }
  for (const row of pending) {
    if (row.slideEdit !== undefined) continue
    register = opened(register, row.node, row.floor ?? "")
  }
  return withSlides(replay(register, seeded), confirmed, pending)
}

function split(rows: readonly StoredRow[]): { confirmed: ConfirmedRow[]; pending: PendingRow[] } {
  const confirmed = rows
    .filter(isConfirmed)
    .filter(readable)
    .sort((left, right) => left.revision - right.revision)
  const pending = rows
    .filter(isPending)
    .filter((row) => readable(row) && (row.slideEdit !== undefined || wired(row)))
    .sort((left, right) => left.order - right.order)
  return { confirmed, pending }
}

function readable(row: StoredRow): boolean {
  if (row.slideEdit !== undefined) {
    return row.slideFile !== undefined && readSlideState({ file: row.slideFile, order: [row.slideEdit] }) !== undefined
  }
  if (isPending(row)) return wired(row)
  return row.node === undefined || row.node === legacyElement || readElementId(row.node) !== undefined
}

function storedKey(deck: DeckId, row: StoredRow): string {
  return isPending(row) ? rowKey(deck, "pending", row.order) : rowKey(deck, "confirmed", row.revision)
}

async function readDeck(deck: DeckId): Promise<StoredRow[]> {
  const rows = await readRows(deck)
  const dropped = rows.filter((row) => !readable(row))
  if (dropped.length === 0) return rows
  await writeRows(
    [],
    dropped.map((row) => storedKey(deck, row)),
  )
  return rows.filter(readable)
}

function wireOf(row: PendingRow): WireEdit | WireSlide {
  if (row.slideEdit !== undefined && row.slideFile !== undefined) return { ...row.slideEdit, file: row.slideFile }
  if (row.node === undefined) throw new Error("missing node")
  if (row.floor === undefined) return { ...storedValue(row), node: row.node }
  return { ...storedValue(row), node: row.node, floor: row.floor }
}

function view(
  deck: DeckId,
  rows: readonly StoredRow[],
): {
  register: Register
  phase: LivePhase
  pending: PendingRow[]
  confirmed: ConfirmedRow[]
} {
  const { confirmed, pending } = split(rows)
  return {
    register: played(deck, confirmed, pending),
    phase: pending.length > 0 ? "on-device" : "confirmed",
    pending,
    confirmed,
  }
}

const flushing = new Map<DeckId, Promise<unknown>>()
type OpenOnceResult = { ok: true } | Extract<OpenResult, { ok: false }>

const openingByRemote = new WeakMap<Remote, Map<DeckId, Promise<OpenResult>>>()
const knownByRemote = new WeakMap<Remote, Map<DeckId, number>>()

function serial<T>(deck: DeckId, work: () => Promise<T>): Promise<T> {
  const before = flushing.get(deck) ?? Promise.resolve()
  const run = before.then(
    () => work(),
    () => work(),
  )
  flushing.set(deck, run)
  return run
}

export function connect(remote: Remote, options: { readonly once?: () => string } = {}) {
  const nextOnce = (options.once ?? crypto.randomUUID).bind(crypto)
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
        return opened
      },
      (error: unknown) => {
        forget(deck, opening)
        throw error
      },
    )
    openingDecks.set(deck, opening)
    return opening
  }

  async function sendRows(deck: DeckId): Promise<CommitResult> {
    const indexed = await sendIndex(remote, deck, () => openOnce(deck))
    if (indexed !== null && !indexed.ok) return indexed
    const { confirmed, pending } = split(await readDeck(deck))
    if (pending.length === 0) return indexed ?? { ok: false, refusal: "batch" }
    const opened = await openOnce(deck)
    if (!opened.ok) return opened
    const sending = unsent(pending, 0)
    let revision = confirmed.reduce((max, row) => Math.max(max, row.revision + 1), 0)
    let result: CommitResult = { ok: false, refusal: "batch" }
    for (let start = 0; start < sending.length;) {
      const first = sending[start]
      if (first === undefined) break
      const rowsInBatch: PendingRow[] = []
      for (const row of sending.slice(start, start + limits.batch)) {
        if (row.once !== first.once) break
        rowsInBatch.push(row)
      }
      const once = first.once ?? nextOnce()
      if (first.once === undefined) {
        await writeRows(
          rowsInBatch.map((row) => ({ key: rowKey(deck, "pending", row.order), row: { ...row, once } })),
          [],
        )
      }
      result = await remote.commit({ deck, batch: rowsInBatch.map(wireOf), once })
      if (!result.ok) return result
      if (result.deck !== deck || result.key !== `${deck}:${result.revision}`) {
        return { ok: false, refusal: "payload" }
      }
      if (known.get(deck) === result.revision - 1) known.set(deck, result.revision)
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
      await writeRows(
        stored.map((row) => ({ key: rowKey(deck, "confirmed", row.revision), row })),
        rowsInBatch.map((row) => rowKey(deck, "pending", row.order)),
      )
      start += rowsInBatch.length
    }
    return result
  }

  async function refresh(deck: DeckId): Promise<OpenResult> {
    const opened = await remote.open({ deck })
    if (!opened.ok) return opened
    const confirmed = rowsFromRegister(deck, opened.register)
    const existing = await readRows(deck)
    await writeRows(
      confirmed.map((row) => ({ key: rowKey(deck, "confirmed", row.revision), row })),
      existing.filter(isConfirmed).map((row) => rowKey(deck, "confirmed", row.revision)),
    )
    openingDecks.set(deck, Promise.resolve(opened))
    known.set(deck, opened.revision)
    return opened
  }

  function enqueueValue(deck: string, edit: Value, node: ElementId, floor: string): Promise<Enqueued> {
    const parsed = readDeckId(deck)
    if (!parsed.ok) return Promise.resolve({ ok: false, refusal: "deck" })
    const named = readElementId(node)
    if (named === undefined) return Promise.resolve({ ok: false, refusal: "dead" })
    return changeRows<Enqueued>(parsed.deck, (rows) => {
      const { confirmed, pending } = split(rows)
      let editing = played(parsed.deck, confirmed, pending)
      let first: string | undefined
      if (!editing.nodes.includes(named)) {
        const added = decide(editing, { command: "add", node: named, floor, route: editing.route })
        if (added.decision === "refuse") return { puts: [], result: { ok: false, refusal: added.code } }
        editing = added.register
        first = floor
      }
      const decision = decide(editing, { command: "person", ...edit, node: named })
      if (decision.decision === "refuse") return { puts: [], result: { ok: false, refusal: decision.code } }
      if (valueBytes(edit) > limits.valueBytes) return { puts: [], result: { ok: false, refusal: "limit" } }
      const body = decision.register.elements[named]
      const order = rows.filter(isPending).reduce((max, row) => Math.max(max, row.order + 1), 0)
      const before = editing.elements[named]
      const base = before === undefined ? 0 : version(before)
      const row = pendingRow(parsed.deck, order, base, edit, named, first)
      return { puts: [{ key: rowKey(parsed.deck, "pending", order), row }], result: { ok: true, body } }
    })
  }

  return {
    index: (deck: string, index: Parameters<typeof queueIndex>[1]) => queueIndex(deck, index, nextOnce),
    layered: hasLayouts,
    async enqueueSlide(
      deck: string,
      file: readonly SlideId[],
      edit: SlideCommand,
    ): Promise<EnqueueResult<readonly string[]>> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      const state = readSlideState({ file, order: [edit] })
      const command = state?.order[0]
      if (state === undefined || command === undefined) return { ok: false, refusal: "field" }
      return changeRows<EnqueueResult<readonly string[]>>(parsed.deck, (rows) => {
        const { confirmed, pending } = split(rows)
        const editing = played(parsed.deck, confirmed, pending)
        const decision = decide(editing, { command: "slide", file: state.file, edit: command })
        if (decision.decision === "refuse") return { puts: [], result: { ok: false, refusal: decision.code } }
        const order = rows.filter(isPending).reduce((max, row) => Math.max(max, row.order + 1), 0)
        const row = {
          kind: "pending" as const,
          deck: parsed.deck,
          order,
          base: 0,
          value: "",
          slideFile: state.file,
          slideEdit: command,
        }
        return {
          puts: [{ key: rowKey(parsed.deck, "pending", order), row }],
          result: { ok: true, painted: presentSlides(decision.register).map((spot) => spot.id) },
        }
      })
    },
    async enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<EnqueueResult> {
      const result = await enqueueValue(deck, { value }, node, floor)
      if (!result.ok) return result
      return { ok: true, painted: result.body === undefined ? value : currentValue(result.body) }
    },
    async enqueueBox(deck: string, box: Box, node: ElementId, floor: string): Promise<EnqueueResult<Box>> {
      const read = readBox(box)
      if (read === null) return { ok: false, refusal: "field" }
      const result = await enqueueValue(deck, { property: "box", value: read }, node, floor)
      if (!result.ok) return result
      return { ok: true, painted: (result.body === undefined ? null : currentBox(result.body)) ?? read }
    },
    async open(deck: string): Promise<OpenOnceResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      const opened = await openOnce(parsed.deck)
      return opened.ok ? { ok: true } : opened
    },
    async flush(deck: string): Promise<CommitResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return { ok: false, refusal: "deck" }
      return serial(parsed.deck, () => sendRows(parsed.deck))
    },
    async openDeck(deck: string): Promise<OpenDeckResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      const rows = await readDeck(parsed.deck)
      if (rows.length > 0) return { ok: true, ...view(parsed.deck, rows) }
      const opened = await openOnce(parsed.deck)
      if (!opened.ok) return opened
      const confirmed = rowsFromRegister(parsed.deck, opened.register)
      if (confirmed.length > 0) {
        await writeRows(
          confirmed.map((row) => ({ key: rowKey(parsed.deck, "confirmed", row.revision), row })),
          [],
        )
      }
      if (!known.has(parsed.deck)) known.set(parsed.deck, opened.revision)
      return { ok: true, ...view(parsed.deck, confirmed) }
    },
    async phase(deck: string): Promise<LivePhase> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return "confirmed"
      const rows = await readDeck(parsed.deck)
      return rows.some(isPending) ? "on-device" : "confirmed"
    },
    async pending(deck: string): Promise<readonly PendingRow[]> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return []
      return split(await readDeck(parsed.deck)).pending
    },
    async rows(deck: string): Promise<readonly StoredRow[]> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return []
      return readDeck(parsed.deck)
    },
    async watch(deck: string, cursor: number | null): Promise<WatchResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      const watched = await remote.watch({ deck: parsed.deck, cursor })
      if (!watched.ok) return watched
      if (cursor === null || watched.revision > cursor) await serial(parsed.deck, () => refresh(parsed.deck))
      return watched
    },
    async follow(deck: string): Promise<FollowResult> {
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
    },
  }
}
