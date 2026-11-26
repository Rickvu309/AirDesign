import { applyEdit } from "./apply-edit.js"
import { parentOf } from "./doom-walk.js"
import { rev } from "./ids.js"
import { parentLanding } from "./parent-landing.js"
import { isRefusal } from "./refusal.js"
import type { Edit, Doom } from "./doom.js"

export function onTop(view: Doom, edit: Edit): Edit {
  return {
    ...edit,
    writes: edit.writes.map((sent) => {
      const { base: sentBase, ...write } = sent
      const was = view.revs.get(write.node)?.get(write.prop)
      if (was === undefined) return write
      const deleted = parentOf(view.nodes.get(sent.node)) === null
      if (sent.prop === "parent" && deleted && sentBase === undefined) return write
      if (sent.prop === "parent" && deleted && parentLanding(view, edit.writes, sent) !== "restore") return sent
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
