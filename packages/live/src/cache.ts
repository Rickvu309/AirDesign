import { readDeckId, type DeckId, type WireEdit, type WireRefusal } from "@airdesign/catalog"
import {
  bytesOf,
  currentValue,
  decide,
  legacyElement,
  rootElement,
  limits,
  openRegister,
  readElementId,
  replay,
  unsent,
  version,
  type ElementId,
  type Queued,
  type Register,
} from "@airdesign/document"
import type { CommitResult, OpenResult, Remote, WatchResult } from "./remote.js"
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

export type EnqueueResult = { ok: true; readonly painted: string } | { ok: false; readonly refusal: WireRefusal }

function rowsFromRegister(deck: DeckId, register: Register): ConfirmedRow[] {
  const into: ConfirmedRow[] = []
  let revision = 0
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body === undefined) continue
    const node = id === rootElement ? undefined : id
    for (const landed of body.landed) {
      if (!landed.visible) continue
      revision = fitConfirmed(deck, revision, landed.value, node, into)
    }
  }
  return into
}

type WiredRow = PendingRow & { readonly node: ElementId }

function wired(row: PendingRow): row is WiredRow {
  return readElementId(row.node) !== undefined
}

function opened(register: Register, node: ElementId | undefined, floor: string): Register {
  if (node === undefined || register.nodes.includes(node)) return register
  const decision = decide(register, { command: "add", node, floor, route: register.route })
  return decision.decision === "apply" ? decision.register : register
}

function played(deck: DeckId, confirmed: readonly ConfirmedRow[], pending: readonly WiredRow[]): Register {
  let register = openRegister("", deck)
  const versions = new Map<string, number>()
  const seeded: Queued[] = []
  for (const row of logicalValues(confirmed)) {
    register = opened(register, row.node, "")
    if (row.node !== undefined && !register.nodes.includes(row.node)) continue
    const base = versions.get(row.node ?? "") ?? 0
    versions.set(row.node ?? "", base + 1)
    seeded.push(row.node === undefined ? { base, value: row.value } : { base, value: row.value, node: row.node })
  }
  for (const row of pending) register = opened(register, row.node, row.floor ?? "")
  const queued = pending
    .filter((row) => register.nodes.includes(row.node))
    .map((row) => ({ base: row.base, value: row.value, node: row.node }))
  return replay(replay(register, seeded), queued)
}

function split(rows: readonly StoredRow[]): { confirmed: ConfirmedRow[]; pending: WiredRow[] } {
  const confirmed = rows
    .filter(isConfirmed)
    .filter(readable)
    .sort((left, right) => left.revision - right.revision)
  const pending = rows
    .filter(isPending)
    .filter(wired)
    .sort((left, right) => left.order - right.order)
  return { confirmed, pending }
}

function readable(row: StoredRow): boolean {
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

function wireOf(row: WiredRow): WireEdit {
  if (row.floor === undefined) return { value: row.value, node: row.node }
  return { value: row.value, node: row.node, floor: row.floor }
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

const openingByRemote = new WeakMap<Remote, Map<DeckId, Promise<OpenOnceResult>>>()

export function connect(remote: Remote, options: { readonly once?: () => string } = {}) {
  const nextOnce = (options.once ?? crypto.randomUUID).bind(crypto)
  const openingDecks = openingByRemote.get(remote) ?? new Map<DeckId, Promise<OpenOnceResult>>()
  openingByRemote.set(remote, openingDecks)

  function forget(deck: DeckId, opening: Promise<OpenOnceResult>) {
    if (openingDecks.get(deck) === opening) openingDecks.delete(deck)
  }

  function openOnce(deck: DeckId): Promise<OpenOnceResult> {
    const known = openingDecks.get(deck)
    if (known !== undefined) return known
    const opening: Promise<OpenOnceResult> = remote.open({ deck }).then(
      (opened) => {
        if (opened.ok) return { ok: true }
        forget(deck, opening)
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
    const { confirmed, pending } = split(await readDeck(deck))
    if (pending.length === 0) return { ok: false, refusal: "batch" }
    const opened = await openOnce(deck)
    if (!opened.ok) return opened
    const sending = unsent(pending, 0)
    let revision = confirmed.reduce((max, row) => Math.max(max, row.revision + 1), 0)
    let result: CommitResult = { ok: false, refusal: "batch" }
    for (let start = 0; start < sending.length;) {
      const first = sending[start]
      if (first === undefined) break
      const rowsInBatch: WiredRow[] = []
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
      const stored: ConfirmedRow[] = []
      for (const row of rowsInBatch) revision = fitConfirmed(deck, revision, row.value, row.node, stored)
      await writeRows(
        stored.map((row) => ({ key: rowKey(deck, "confirmed", row.revision), row })),
        rowsInBatch.map((row) => rowKey(deck, "pending", row.order)),
      )
      start += rowsInBatch.length
    }
    return result
  }

  return {
    async enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<EnqueueResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return { ok: false, refusal: "deck" }
      const named = readElementId(node)
      if (named === undefined) return { ok: false, refusal: "dead" }
      return changeRows<EnqueueResult>(parsed.deck, (rows) => {
        const { confirmed, pending } = split(rows)
        let editing = played(parsed.deck, confirmed, pending)
        let first: string | undefined
        if (!editing.nodes.includes(named)) {
          const added = decide(editing, { command: "add", node: named, floor, route: editing.route })
          if (added.decision === "refuse") return { puts: [], result: { ok: false, refusal: added.code } }
          editing = added.register
          first = floor
        }
        const decision = decide(editing, { command: "person", value, node: named })
        if (decision.decision === "refuse") return { puts: [], result: { ok: false, refusal: decision.code } }
        if (bytesOf(value) > limits.valueBytes) return { puts: [], result: { ok: false, refusal: "limit" } }
        const order = rows.filter(isPending).reduce((max, row) => Math.max(max, row.order + 1), 0)
        const before = editing.elements[named]
        const base = before === undefined ? 0 : version(before)
        const row = pendingRow(parsed.deck, order, base, value, named, first)
        const body = decision.register.elements[named]
        return {
          puts: [{ key: rowKey(parsed.deck, "pending", order), row }],
          result: { ok: true, painted: body === undefined ? value : currentValue(body) },
        }
      })
    },
    async open(deck: string): Promise<OpenOnceResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      return openOnce(parsed.deck)
    },
    async flush(deck: string): Promise<CommitResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return { ok: false, refusal: "deck" }
      const before = flushing.get(parsed.deck) ?? Promise.resolve()
      const sent = before.then(
        () => sendRows(parsed.deck),
        () => sendRows(parsed.deck),
      )
      flushing.set(parsed.deck, sent)
      return sent
    },
    async openDeck(deck: string): Promise<OpenDeckResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      const rows = await readDeck(parsed.deck)
      if (rows.length > 0) return { ok: true, ...view(parsed.deck, rows) }
      const opened: OpenResult = await remote.open({ deck: parsed.deck })
      if (!opened.ok) return opened
      const confirmed = rowsFromRegister(parsed.deck, opened.register)
      if (confirmed.length > 0) {
        await writeRows(
          confirmed.map((row) => ({ key: rowKey(parsed.deck, "confirmed", row.revision), row })),
          [],
        )
      }
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
      if (cursor === null || watched.revision > cursor) {
        const opened = await remote.open({ deck: parsed.deck })
        if (opened.ok) {
          const confirmed = rowsFromRegister(parsed.deck, opened.register)
          const existing = await readRows(parsed.deck)
          await writeRows(
            confirmed.map((row) => ({ key: rowKey(parsed.deck, "confirmed", row.revision), row })),
            existing.filter(isConfirmed).map((row) => rowKey(parsed.deck, "confirmed", row.revision)),
          )
        }
      }
      return watched
    },
  }
}
