import type { Intent, IntentBox } from "./intent-read.js"
import { compileInsertLayer } from "./intent-add.js"
import { type Draft, keysAfter, living, stop } from "./intent-draft.js"
import type { NodeId } from "./ids.js"
import { parentOf, propOf } from "./doom-walk.js"

const boxSides = ["x", "y", "w", "h"] as const

function boxFor(held: IntentBox | undefined, asked: Partial<IntentBox> | undefined): IntentBox | undefined {
  if (held === undefined && asked === undefined) return undefined
  const box = { ...(held === undefined ? {} : { x: held.x, y: held.y, w: held.w, h: held.h }), ...asked }
  const missing = boxSides.find((side) => box[side] === undefined)
  return missing === undefined ? (box as IntentBox) : stop("shape", undefined, `box.${missing}`, "missing")
}

export function compileReplace(draft: Draft, intent: Extract<Intent, { op: "replace" }>): void {
  const { op: _op, target, kind, box: asked, ...look } = intent
  const old = living(draft, target, "target")
  const parent = parentOf(old)?.id
  if ((old.type !== "frame" && old.type !== "shape") || parent === undefined)
    stop("shape", old.id, "target", "form", { code: "layer" })
  const box = boxFor(propOf(old, "box"), asked)
  const start = draft.writes.length
  compileInsertLayer(draft, { ...look, op: "insert", kind, parent, ...(box === undefined ? {} : { box }) }, undefined)
  const made = draft.writes.findIndex(
    (write, at) =>
      at >= start &&
      write.prop === "parent" &&
      (write.value as { readonly id?: NodeId } | null)?.id === parent &&
      draft.writes.some((typed) => typed.node === write.node && typed.prop === "type"),
  )
  const placed = draft.writes[made]
  if (placed === undefined) return stop("shape", old.id, "kind", "form", { code: "layer" })
  const [key] = keysAfter(draft, parent, old.id, 1)
  draft.writes[made] = { ...placed, value: { id: parent, at: key } }
  draft.writes.push({ node: old.id, prop: "parent", value: null })
}
