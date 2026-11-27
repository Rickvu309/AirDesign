import * as doom from "@airdesign/doom"
import type { GestureId } from "@/lib/gestures"
import { flipIntents, ungrouped, wrapped } from "./arrange-intents"
import { intentWrites, removeIntents } from "./editor-intents"
import { toggleIntents } from "./toggle-intents"
import { noSelection, type Selection } from "./selection"
import type { SlideGeometry } from "@/editing/slide-geometry"
import type { EditorClient } from "./use-deck"

export type ArrangeContext = {
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly measure: doom.Measure | null
  readonly selection: Selection
  readonly slide: doom.NodeId
  readonly onSelection: (next: Selection) => void
}

let held: doom.Clipboard | null = null

function pasteTarget(view: doom.Doom, selection: Selection, slide: doom.NodeId): doom.NodeId {
  const [first] = selection.ids
  if (first === undefined) return slide
  if (selection.ids.length === 1 && view.nodes.get(first)?.type === "frame") return first
  return doom.parentOf(view.nodes.get(first))?.id ?? slide
}

function landed(context: ArrangeContext, writes: readonly doom.Write[], selected?: readonly doom.NodeId[]) {
  if (!context.client.push(writes).ok) return
  if (selected !== undefined) context.onSelection({ ids: selected, inside: context.selection.inside })
}

function compiled(context: ArrangeContext, intents: readonly doom.Intent[]) {
  if (intents.length === 0) return
  const made = intentWrites(context.view, intents, { measure: context.measure })
  if (made !== null) landed(context, made.writes)
}

export function arranged(gesture: GestureId | null, context: ArrangeContext): boolean {
  const { client, view, geometry, measure, selection, slide } = context
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
        compiled(context, removeIntents(view, roots))
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
      const made = wrapped(view, geometry, ids, gesture === "group" ? "group" : "frame", client.mint, measure)
      if (made !== null) landed(context, made.writes, made.selected)
      return true
    }
    case "ungroup": {
      const made = ungrouped(view, geometry, ids, measure)
      if (made !== null) landed(context, made.writes, made.selected)
      return true
    }
    case "forward":
    case "backward":
    case "front":
    case "back":
      landed(context, doom.reorderWrites(view, ids, gesture))
      return true
    case "flip-horizontal":
    case "flip-vertical":
      compiled(context, flipIntents(view, geometry, ids, gesture === "flip-horizontal" ? "horizontal" : "vertical"))
      return true
    case "hide":
    case "lock":
      compiled(context, toggleIntents(view, ids, gesture === "hide" ? "hidden" : "locked"))
      return true
    default:
      return false
  }
}
