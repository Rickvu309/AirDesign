import { applyEdit } from "./apply-edit.js"
import { rev } from "./ids.js"
import { isRefusal } from "./refusal.js"
import type { Edit, Doom } from "./doom.js"

const deletedParent = (view: Doom, id: Edit["writes"][number]["node"]) =>
  (view.nodes.get(id) as { parent?: unknown } | undefined)?.parent === null

export function onTop(view: Doom, edit: Edit): Edit {
  return {
    ...edit,
    writes: edit.writes.map((sent) => {
      const { base: sentBase, ...write } = sent
      const was = view.revs.get(write.node)?.get(write.prop)
      if (was === undefined) return write
      // A move carries no base. Stamping the delete's rev would make it the undo that brings the layer back.
      if (write.prop === "parent" && deletedParent(view, write.node) && sentBase === undefined) return write
      return { ...write, base: was }
    }),
  }
}

export function viewOf(server: Doom, pending: readonly Edit[]): Doom {
  let view = server
  for (const edit of pending) {
    const next = applyEdit(view, { ...onTop(view, edit), rev: rev(view.rev + 1) })
    if (!isRefusal(next)) view = next
  }
  return view
}
