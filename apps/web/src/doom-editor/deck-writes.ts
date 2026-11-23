import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"

export function deckNodeOf(view: doom.Doom): doom.NodeId | null {
  return [...view.nodes.values()].find((node) => node.type === "deck")?.id ?? null
}

export function renameWrites(view: doom.Doom, name: string): readonly doom.Write[] {
  const deck = deckNodeOf(view)
  return deck === null ? [] : [{ node: deck, prop: "name", value: name }]
}

export function notesOf(view: doom.Doom, slide: doom.NodeId | undefined): string {
  return slide === undefined ? "" : (propOf(view.nodes.get(slide), "notes")?.chars ?? "")
}

export function notesWrites(view: doom.Doom, slide: doom.NodeId, chars: string): readonly doom.Write[] {
  if (view.nodes.get(slide)?.type !== "slide" || chars === notesOf(view, slide)) return []
  return [{ node: slide, prop: "notes", value: doom.notesText(chars) }]
}
