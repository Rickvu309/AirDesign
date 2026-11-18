import { format } from "@airdesign/document"
import type { DeckId, WireRefusal } from "@airdesign/catalog"
import {
  decide,
  limits,
  presentSlides,
  valueBytes,
  version,
  type ElementId,
  type NodeRegister,
  type Register,
  type SlideCommand,
  type SlideId,
  type Value,
} from "@airdesign/document"
import { bodyBytes, fitsAlone } from "./commit-body.js"
import { joinable } from "./deck-view.js"
import type { Change, Held, Put } from "./held.js"
import { pendingRow, rowKey, type PendingRow } from "./store.js"

export type Enqueued =
  | { ok: true; readonly body: NodeRegister | undefined }
  | { ok: false; readonly refusal: WireRefusal }

export type SlideEnqueued =
  | { ok: true; readonly painted: readonly string[] }
  | { ok: false; readonly refusal: WireRefusal }

const tooLarge = { ok: false, refusal: "size" } as const

function refused<Result>(result: Result): Change<Result> {
  return { puts: [], result }
}

function joins(held: Held, edit: Value, node: ElementId): PendingRow | undefined {
  const last = held.pending.at(-1)
  if (!joinable(last) || held.before === undefined || last.node !== node) return undefined
  if (edit.v !== undefined || last.v !== undefined) return undefined
  return (last.property === "box") === (edit.property === "box") ? last : undefined
}

function edited(
  register: Register,
  edit: Value,
  node: ElementId,
  floor: string,
): { ok: true; readonly editing: Register; readonly after: Register; readonly added: boolean } | Enqueued {
  let editing = register
  let added = false
  if (!editing.nodes.includes(node)) {
    const opened = decide(editing, { command: "add", node, floor, route: editing.route })
    if (opened.decision === "refuse") return { ok: false, refusal: opened.code }
    editing = opened.register
    added = true
  }
  const decision = decide(editing, { command: "person", ...edit, node })
  if (decision.decision === "refuse") return { ok: false, refusal: decision.code }
  if (valueBytes(edit) > limits.valueBytes) return { ok: false, refusal: "limit" }
  return { ok: true, editing, after: decision.register, added }
}

export function valueChange(deck: DeckId, held: Held, edit: Value, node: ElementId, floor: string): Change<Enqueued> {
  const joined = joins(held, edit, node)
  if (joined !== undefined && held.before !== undefined) {
    const made = edited(held.before, edit, node, joined.floor ?? floor)
    if (!("editing" in made)) return refused(made)
    const row = pendingRow(deck, joined.order, joined.base, edit, node, joined.floor)
    if (!fitsAlone(deck, row)) return refused(tooLarge)
    return {
      next: { ...held, pending: [...held.pending.slice(0, -1), row], register: made.after },
      puts: [{ key: rowKey(deck, "pending", row.order), row }],
      result: { ok: true, body: made.after.elements[node] },
    }
  }
  const made = edited(held.register, edit, node, floor)
  if (!("editing" in made)) return refused(made)
  const order = (held.pending.at(-1)?.order ?? -1) + 1
  const before = made.editing.elements[node]
  const row = pendingRow(
    deck,
    order,
    before === undefined ? 0 : version(before),
    edit,
    node,
    made.added ? floor : undefined,
  )
  if (!fitsAlone(deck, row)) return refused(tooLarge)
  return {
    next: { ...held, pending: [...held.pending, row], register: made.after, before: held.register },
    puts: [{ key: rowKey(deck, "pending", order), row }],
    result: { ok: true, body: made.after.elements[node] },
  }
}

export function slideChange(
  deck: DeckId,
  held: Held,
  file: readonly SlideId[],
  command: SlideCommand,
): Change<SlideEnqueued> {
  const decision = decide(held.register, { command: "slide", file, edit: command })
  if (decision.decision === "refuse") return refused({ ok: false, refusal: decision.code })
  const order = (held.pending.at(-1)?.order ?? -1) + 1
  const row: PendingRow = {
    kind: "pending",
    deck,
    order,
    base: 0,
    value: "",
    format,
    slideFile: file,
    slideEdit: command,
  }
  if (!fitsAlone(deck, row)) return refused(tooLarge)
  return {
    next: { ...held, pending: [...held.pending, row], register: decision.register, before: undefined },
    puts: [{ key: rowKey(deck, "pending", order), row }],
    result: { ok: true, painted: presentSlides(decision.register).map((spot) => spot.id) },
  }
}

export function slideBatch(
  deck: DeckId,
  held: Held,
  file: readonly SlideId[],
  commands: readonly SlideCommand[],
  once: string,
): Change<SlideEnqueued> {
  if (commands.length === 0 || commands.length > limits.batch) return refused({ ok: false, refusal: "batch" })
  let current = held
  const puts: Put[] = []
  const rows: PendingRow[] = []
  for (const command of commands) {
    const planned = slideChange(deck, current, file, command)
    if (!planned.result.ok || planned.next === undefined) return refused(planned.result)
    current = { ...current, ...planned.next }
    for (const { key, row } of planned.puts) {
      if (row.kind !== "pending") continue
      rows.push({ ...row, once })
      puts.push({ key, row: { ...row, once } })
    }
  }
  if (bodyBytes(deck, rows, once) > limits.body) return refused(tooLarge)
  return {
    next: { ...current, pending: [...held.pending, ...rows] },
    puts,
    result: { ok: true, painted: presentSlides(current.register).map((spot) => spot.id) },
  }
}
