import { rev } from "./ids.js"
import { applyEdit } from "./apply-edit.js"
import { isRefusal } from "./refusal.js"
import type { Edit, Scene } from "./scene.js"

export function viewOf(server: Scene, pending: readonly Edit[]): Scene {
  let view = server
  for (const edit of pending) {
    const next = applyEdit(view, { ...edit, rev: rev(view.rev + 1) })
    if (!isRefusal(next)) view = next
  }
  return view
}
