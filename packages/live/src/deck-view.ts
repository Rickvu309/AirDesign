import type { DeckId } from "@airdesign/catalog"
import {
  decide,
  format,
  newerFormat,
  newerSlideCommand,
  legacyElement,
  openRegister,
  readElementId,
  readRow,
  readSlideState,
  replay,
  rootElement,
  storedValue,
  type ElementId,
  type Queued,
  type Register,
} from "@airdesign/document"
import { withSlides } from "./slide-replay.js"
import {
  fitConfirmed,
  isConfirmed,
  isPending,
  logicalValues,
  rowKey,
  type ConfirmedRow,
  type PendingRow,
  type StoredRow,
} from "./store.js"

export type LivePhase = "on-device" | "confirmed"

export type DeckView = {
  readonly register: Register
  readonly phase: LivePhase
  readonly pending: PendingRow[]
  readonly confirmed: ConfirmedRow[]
}

export function rowsFromRegister(deck: DeckId, register: Register): ConfirmedRow[] {
  const into: ConfirmedRow[] = []
  let revision = 0
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body === undefined) continue
    const node = id === rootElement ? undefined : id
    const first = into.length
    for (const landed of body.landed) {
      if (!landed.visible) continue
      const floor = node !== undefined && into.length === first ? body.floor : ""
      revision = fitConfirmed(deck, revision, landed, node, into, floor)
    }
  }
  for (const edit of register.order) {
    into.push({ kind: "confirmed", deck, revision, value: "", format, slideFile: register.file, slideEdit: edit })
    revision += 1
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

export function played(deck: DeckId, confirmed: readonly ConfirmedRow[], pending: readonly PendingRow[]): Register {
  if ([...confirmed, ...pending].some(newerRow)) throw new Error("newer")
  let register = openRegister("", deck)
  const versions = new Map<string, number>()
  const seeded: Queued[] = []
  for (const row of logicalValues(confirmed)) {
    register = opened(register, row.node, row.floor ?? "")
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

export function newerRow(row: StoredRow): boolean {
  if (newerFormat(row) || newerSlideCommand(row.slideEdit)) return true
  const read = row.slideEdit === undefined ? readRow(row, "text") : null
  return read !== null && !read.ok && read.refusal === "newer"
}

export function readable(row: StoredRow): boolean {
  if (row.slideEdit !== undefined) {
    return row.slideFile !== undefined && readSlideState({ file: row.slideFile, order: [row.slideEdit] }) !== undefined
  }
  if (!readRow(row, "text").ok) return false
  if (isPending(row)) return wired(row)
  return row.node === undefined || row.node === legacyElement || readElementId(row.node) !== undefined
}

export function split(rows: readonly StoredRow[]): { confirmed: ConfirmedRow[]; pending: PendingRow[] } {
  if (rows.some(newerRow)) throw new Error("newer")
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

export function storedKey(deck: string, row: StoredRow): string {
  return isPending(row) ? rowKey(deck, "pending", row.order) : rowKey(deck, "confirmed", row.revision)
}

export function deckView(register: Register, confirmed: ConfirmedRow[], pending: PendingRow[]): DeckView {
  const phase = pending.length > 0 ? "on-device" : "confirmed"
  return { register, phase, pending, confirmed }
}

export function view(deck: DeckId, rows: readonly StoredRow[]): DeckView {
  const { confirmed, pending } = split(rows)
  return deckView(played(deck, confirmed, pending), confirmed, pending)
}

export function joinable(row: PendingRow | undefined): row is WiredRow {
  return row !== undefined && row.slideEdit === undefined && row.once === undefined && wired(row)
}
