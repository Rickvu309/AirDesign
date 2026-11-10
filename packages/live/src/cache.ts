import { readDeckId, type DeckId, type WireEdit } from "@airdesign/catalog"
import {
  currentValue,
  decide,
  openRegister,
  replay,
  unsent,
  version,
  type NodeName,
  type Register,
} from "@airdesign/document"
import type { CommitResult, OpenResult, Remote, WatchResult } from "./remote.js"
import {
  fitConfirmed,
  isConfirmed,
  isPending,
  logicalValues,
  pendingRow,
  readRows,
  rowBytes,
  rowCap,
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
  | { ok: false; readonly refusal: "field" | "deck" | "session" }

export type EnqueueResult = { ok: true; readonly painted: string } | { ok: false; readonly refusal: string }

function rowsFromRegister(deck: DeckId, register: Register): ConfirmedRow[] {
  const into: ConfirmedRow[] = []
  let revision = 0
  for (const landed of register.landed) {
    if (!landed.visible) continue
    revision = fitConfirmed(deck, revision, landed.value, undefined, into)
  }
  if (register.b !== null) {
    for (const landed of register.b.landed) {
      if (!landed.visible) continue
      revision = fitConfirmed(deck, revision, landed.value, "b", into)
    }
  }
  return into
}

function played(deck: DeckId, confirmed: readonly ConfirmedRow[], pending: readonly PendingRow[]): Register {
  const seeded = logicalValues(confirmed).map((value, index) => ({ base: index, value }))
  const queued = pending.map((row) => ({ base: row.base, value: row.value }))
  return replay(replay(openRegister("", deck), seeded), queued)
}

function split(rows: readonly StoredRow[]): { confirmed: ConfirmedRow[]; pending: PendingRow[] } {
  const confirmed = rows.filter(isConfirmed).sort((left, right) => left.revision - right.revision)
  const pending = rows.filter(isPending).sort((left, right) => left.order - right.order)
  return { confirmed, pending }
}

function wireOf(row: PendingRow): WireEdit {
  if (row.node === undefined) return { value: row.value }
  return { value: row.value, node: row.node }
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

export function connect(remote: Remote) {
  return {
    async enqueue(deck: string, value: string, node?: NodeName): Promise<EnqueueResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return { ok: false, refusal: "deck" }
      const rows = await readRows(parsed.deck)
      const { confirmed, pending } = split(rows)
      const register = played(parsed.deck, confirmed, pending)
      const decision = decide(
        register,
        node === undefined ? { command: "person", value } : { command: "person", value, node },
      )
      if (decision.decision === "refuse") return { ok: false, refusal: decision.code }
      const order = pending.reduce((max, row) => Math.max(max, row.order + 1), 0)
      const row = pendingRow(parsed.deck, order, version(register), value, node)
      if (rowBytes(row) >= rowCap) return { ok: false, refusal: "limit" }
      await writeRows([{ key: rowKey(parsed.deck, "pending", order), row }], [])
      return { ok: true, painted: currentValue(decision.register) }
    },
    async flush(deck: string): Promise<CommitResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return { ok: false, refusal: "deck" }
      const rows = await readRows(parsed.deck)
      const { confirmed, pending } = split(rows)
      if (pending.length === 0) return { ok: false, refusal: "batch" }
      const result = await remote.commit({ deck: parsed.deck, batch: unsent(pending, 0).map(wireOf) })
      if (!result.ok) return result
      if (result.deck !== parsed.deck || result.key !== `${parsed.deck}:${result.revision}`) {
        return { ok: false, refusal: "payload" }
      }
      let revision = confirmed.reduce((max, row) => Math.max(max, row.revision + 1), 0)
      const stored: ConfirmedRow[] = []
      for (const row of pending) revision = fitConfirmed(parsed.deck, revision, row.value, row.node, stored)
      await writeRows(
        stored.map((row) => ({ key: rowKey(parsed.deck, "confirmed", row.revision), row })),
        pending.map((row) => rowKey(parsed.deck, "pending", row.order)),
      )
      return result
    },
    async openDeck(deck: string): Promise<OpenDeckResult> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return parsed
      const rows = await readRows(parsed.deck)
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
      const rows = await readRows(parsed.deck)
      return rows.some(isPending) ? "on-device" : "confirmed"
    },
    async pending(deck: string): Promise<readonly PendingRow[]> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return []
      return split(await readRows(parsed.deck)).pending
    },
    async rows(deck: string): Promise<readonly StoredRow[]> {
      const parsed = readDeckId(deck)
      if (!parsed.ok) return []
      return readRows(parsed.deck)
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
