import type { scene } from "@airdesign/document"
import { propOf } from "./node-props"

export function deckNodeOf(view: scene.Scene): scene.NodeId | null {
  return [...view.nodes.values()].find((node) => node.type === "deck")?.id ?? null
}

export function renameWrites(view: scene.Scene, name: string): readonly scene.Write[] {
  const deck = deckNodeOf(view)
  return deck === null ? [] : [{ node: deck, prop: "name", value: name }]
}

export function notesText(chars: string): scene.Text {
  return { chars, spans: [], paras: chars.split("\n").map(() => ({})), style: "body", resize: "height", alignV: "top" }
}

export function notesOf(view: scene.Scene, slide: scene.NodeId | undefined): string {
  return slide === undefined ? "" : (propOf(view.nodes.get(slide), "notes")?.chars ?? "")
}

export function notesWrites(view: scene.Scene, slide: scene.NodeId, chars: string): readonly scene.Write[] {
  if (view.nodes.get(slide)?.type !== "slide" || chars === notesOf(view, slide)) return []
  return [{ node: slide, prop: "notes", value: notesText(chars) }]
}
