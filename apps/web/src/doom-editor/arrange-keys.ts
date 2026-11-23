import * as doom from "@airdesign/doom"
import type { GestureId } from "@/lib/gestures"
import { deleteWrites } from "./delete-writes"
import { flipWrites, toggleWrites } from "./flip-writes"
import { wrapWrites, ungroupWrites } from "./group-writes"
import { parentSlot } from "@/editing/node-props"
import { orderWrites } from "./order-writes"
import { noSelection, type Selection } from "./selection"
import type { SlideGeometry } from "./slide-geometry"
import type { EditorClient } from "./use-doom-deck"

export type ArrangeContext = {
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly selection: Selection
  readonly slide: doom.NodeId
  readonly onSelection: (next: Selection) => void
}

let held: doom.Clipboard | null = null

function pasteTarget(view: doom.Doom, selection: Selection, slide: doom.NodeId): doom.NodeId {
  const [first] = selection.ids
  if (first === undefined) return slide
  if (selection.ids.length === 1 && view.nodes.get(first)?.type === "frame") return first
  return parentSlot(view, first)?.id ?? slide
}

function landed(context: ArrangeContext, writes: readonly doom.Write[], selected?: readonly doom.NodeId[]) {
  if (!context.client.push(writes).ok) return
  if (selected !== undefined) context.onSelection({ ids: selected, inside: context.selection.inside })
}

export function arranged(gesture: GestureId | null, context: ArrangeContext): boolean {
  const { client, view, geometry, selection, slide } = context
  const ids = selection.ids
  switch (gesture) {
    case "duplicate": {
      const copies = doom.duplicateWrites(view, ids, client.mint)
      landed(context, copies.writes, copies.roots)
      return true
    }
    case "copy":
    case "cut": {
      const roots = ids.filter((id) => view.nodes.has(id))
      if (roots.length > 0) held = { view, roots }
      if (gesture === "cut") {
        landed(context, deleteWrites(view, roots))
        context.onSelection(noSelection)
      }
      return true
    }
    case "paste": {
      if (held === null) return false
      const copies = doom.pasteWrites(held, view, pasteTarget(view, selection, slide), client.mint)
      landed(context, copies.writes, copies.roots)
      return true
    }
    case "group":
    case "frame": {
      const made = wrapWrites(view, geometry, ids, gesture === "group" ? "group" : "frame", client.mint)
      if (made !== null) landed(context, made.writes, made.selected)
      return true
    }
    case "ungroup": {
      const made = ungroupWrites(view, geometry, ids)
      if (made !== null) landed(context, made.writes, made.selected)
      return true
    }
    case "forward":
    case "backward":
    case "front":
    case "back":
      landed(context, orderWrites(view, ids, gesture))
      return true
    case "flip-horizontal":
    case "flip-vertical":
      landed(context, flipWrites(view, geometry, ids, gesture === "flip-horizontal" ? "horizontal" : "vertical"))
      return true
    case "hide":
    case "lock":
      landed(context, toggleWrites(view, ids, gesture === "hide" ? "hidden" : "locked"))
      return true
    default:
      return false
  }
}
