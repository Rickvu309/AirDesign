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
import { joinable } from "./deck-view.js"
import type { Change, Held } from "./held.js"
import { pendingRow, rowKey, type PendingRow } from "./store.js"

export type Enqueued =
  | { ok: true; readonly body: NodeRegister | undefined }
  | { ok: false; readonly refusal: WireRefusal }

export type SlideEnqueued =
  | { ok: true; readonly painted: readonly string[] }
  | { ok: false; readonly refusal: WireRefusal }

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
  const row: PendingRow = { kind: "pending", deck, order, base: 0, value: "", slideFile: file, slideEdit: command }
  return {
    next: { ...held, pending: [...held.pending, row], register: decision.register, before: undefined },
    puts: [{ key: rowKey(deck, "pending", order), row }],
    result: { ok: true, painted: presentSlides(decision.register).map((spot) => spot.id) },
  }
}
