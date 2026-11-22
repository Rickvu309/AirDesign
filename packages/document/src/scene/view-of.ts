import { applyEdit } from "./apply-edit.js"
import { rev } from "./ids.js"
import { isRefusal } from "./refusal.js"
import type { Edit, Scene } from "./scene.js"

export function onTop(view: Scene, edit: Edit): Edit {
  return {
    ...edit,
    writes: edit.writes.map(({ base: _sent, ...write }) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
  }
}

export function viewOf(server: Scene, pending: readonly Edit[]): Scene {
  let view = server
  for (const edit of pending) {
    const next = applyEdit(view, { ...onTop(view, edit), rev: rev(view.rev + 1) })
    if (!isRefusal(next)) view = next
  }
  return view
}
