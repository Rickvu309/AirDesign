import type { DeckId } from "@airdesign/catalog"
import {
  decide,
  format,
  openRegister,
  readElementId,
  readStoredEdit,
  replay,
  rootElement,
  storedValue,
  type ElementId,
  type Queued,
  type Register,
  type StoredEdit,
  type StoredRead,
} from "@airdesign/document"
import type { GridOpening } from "./grid-opening.js"
import { withSlides } from "./slide-replay.js"
import {
  confirmedRow,
  fitConfirmed,
  isConfirmed,
  isPending,
  logicalValues,
  pendingRow,
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

export function played(
  deck: DeckId,
  confirmed: readonly ConfirmedRow[],
  pending: readonly PendingRow[],
  opening?: GridOpening,
): Register {
  let register = openRegister("", deck)
  if (opening !== undefined) {
    register = { ...register, file: opening.file, sectionStarts: opening.sectionStarts }
  }
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

const payload = { ok: false, refusal: "payload" } as const

function storedEdit(row: StoredRow): unknown {
  if (row.slideEdit !== undefined) return { format: row.format, file: row.slideFile, edits: [row.slideEdit] }
  return { format: row.format, node: row.node, floor: row.floor, value: row }
}

function nodeRow(row: StoredRow, edit: Extract<StoredEdit, { readonly value: unknown }>, node: ElementId): StoredRow {
  if (row.kind === "confirmed") return confirmedRow(row.deck, row.revision, edit.value, node)
  const pending = pendingRow(row.deck, row.order, row.base, edit.value, node, edit.floor)
  return row.once === undefined ? pending : { ...pending, once: row.once }
}

export function readStored(row: StoredRow): StoredRead<StoredRow> {
  const read = readStoredEdit(storedEdit(row))
  if (!read.ok) return read
  const edit = read.value
  if ("edits" in edit) {
    const [slideEdit] = edit.edits
    return slideEdit === undefined ? payload : { ok: true, value: { ...row, slideFile: edit.file, slideEdit } }
  }
  const node = edit.node
  if (row.slideEdit !== undefined) return node === undefined ? payload : { ok: true, value: nodeRow(row, edit, node) }
  return {
    ok: true,
    value: { ...row, ...storedValue(edit.value), ...(node === undefined ? {} : { node }) } as StoredRow,
  }
}

function newer(read: StoredRead<StoredRow>): boolean {
  return !read.ok && read.refusal === "newer"
}

function unwired(row: StoredRow): boolean {
  return isPending(row) && row.slideEdit === undefined && !wired(row)
}

export function readStoredRows(rows: readonly StoredRow[]): {
  readonly held: boolean
  readonly read: readonly StoredRow[]
  readonly dropped: readonly StoredRow[]
} {
  const reads = rows.map(readStored)
  const unread = rows.filter((_, at) => reads[at]?.ok !== true)
  const read = reads.flatMap((each) => (each.ok ? [each.value] : []))
  return {
    held: reads.some(newer) || unread.some(isPending),
    read: read.filter((row) => !unwired(row)),
    dropped: [...unread.filter(isConfirmed), ...read.filter(unwired)],
  }
}

export function split(rows: readonly StoredRow[]): { confirmed: ConfirmedRow[]; pending: PendingRow[] } {
  const read = readStoredRows(rows)
  if (read.held) throw new Error("newer")
  const confirmed = read.read.filter(isConfirmed).sort((left, right) => left.revision - right.revision)
  const pending = read.read.filter(isPending).sort((left, right) => left.order - right.order)
  return { confirmed, pending }
}

export function storedKey(deck: string, row: StoredRow): string {
  return isPending(row) ? rowKey(deck, "pending", row.order) : rowKey(deck, "confirmed", row.revision)
}

export function deckView(register: Register, confirmed: ConfirmedRow[], pending: PendingRow[]): DeckView {
  const phase = pending.length > 0 ? "on-device" : "confirmed"
  return { register, phase, pending, confirmed }
}

export function view(deck: DeckId, rows: readonly StoredRow[], opening?: GridOpening): DeckView {
  const { confirmed, pending } = split(rows)
  return deckView(played(deck, confirmed, pending, opening), confirmed, pending)
}

export function joinable(row: PendingRow | undefined): row is WiredRow {
  return row !== undefined && row.slideEdit === undefined && row.once === undefined && wired(row)
}
