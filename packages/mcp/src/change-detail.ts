import type { AgentChange } from "@airdesign/catalog"
import {
  readSlideId,
  presentSlides,
  openingElement,
  elementGone,
  shapeOf,
  indexFacts,
  type ElementId,
} from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import type { EditCode } from "./edit-next.js"
import { kindSentence } from "./kind-refusal.js"

function addDetail(deck: Deck, slide: string): string {
  const id = readSlideId(slide)
  const present = id !== undefined && presentSlides(deck.register).some((spot) => spot.id === id)
  if (!present) return `Slide ${slide}: choose a present slide from airdesign_read_deck.`
  return `Slide ${slide}: the deck's index lacks this slide's size or shape ids. Open the deck in AirDesign to index it again, then send this call again.`
}

function deleteDetail(deck: Deck, node: ElementId, code: EditCode): string | undefined {
  if (code === "group-box")
    return `Layer ${node} is inside a group, and deleting it is not supported. Edit its text instead.`
  if (code === "locked")
    return `Layer ${node} has an animation. The exported PowerPoint file cannot lose it, so it stays.`
  if (code === "kind") {
    const opening = openingElement(deck.register, node)
    if (opening === undefined) return undefined
    return kindSentence(node, { facts: indexFacts(opening, false), missing: ["remove"], box: null })
  }
  if (code !== "dead") return undefined
  const gone = readSlideId(shapeOf(node).slide) !== undefined && elementGone(deck.register, node)
  return gone
    ? `Layer ${node} was already deleted.`
    : `Layer ${node}: the deck has no such layer on a present slide. Read the deck again and choose a layer from it.`
}

export function changeDetail(deck: Deck, changes: readonly AgentChange[], code: EditCode): string | undefined {
  if (changes.length !== 1) return undefined
  const change = changes[0]
  if (change === undefined || !("op" in change)) return undefined
  if (change.op === "delete") return deleteDetail(deck, change.node, code)
  if (change.op === "add" && code === "dead") return addDetail(deck, change.slide)
  return undefined
}
