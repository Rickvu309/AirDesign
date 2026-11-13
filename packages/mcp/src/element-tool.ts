import { elementReaders, type ElementOp } from "@airdesign/catalog"
import {
  elementGone,
  presentSlides,
  readSlideId,
  shapeOf,
  version,
  type Box,
  type ElementId,
} from "@airdesign/document"
import { call, type Deck } from "@airdesign/engine"
import type { Session, ToolResult } from "./call-tool.js"
import { editDeck } from "./edit-tool.js"
import { editRefusal, type EditAnswer } from "./edit-answer.js"
import type { EditCode } from "./edit-next.js"
import { stopForNewTurn } from "./run.js"
import { heldRun, holders } from "./turn.js"

function addDetail(deck: Deck, slide: string): string {
  const id = readSlideId(slide)
  const present = id !== undefined && presentSlides(deck.register).some((spot) => spot.id === id)
  if (!present) return `Slide ${slide}: choose a present slide from airdesign_read_deck.`
  return `Slide ${slide}: the deck's index lacks this slide's size or shape ids. Open the deck in AirDesign to index it again, then send this call again.`
}

function deleteDetail(deck: Deck, node: ElementId, code: EditCode): string | undefined {
  if (code === "group-box")
    return `Element ${node} is a group or inside a group, and deleting it is not supported. Edit its text instead.`
  if (code === "locked")
    return `Element ${node} has an animation. The exported PowerPoint file cannot lose it, so it stays.`
  if (code !== "dead") return undefined
  const gone = readSlideId(shapeOf(node).slide) !== undefined && elementGone(deck.register, node)
  return gone
    ? `Element ${node} was already deleted.`
    : `Element ${node}: the deck has no such element on a present slide. Read the deck again and choose an element from it.`
}

function failed(before: Deck, code: EditCode, detail: string | undefined): ToolResult {
  return editRefusal(before, code, [], code === "indexing" ? undefined : detail)
}

function answered(deck: Deck, runId: string, elements: EditAnswer["elements"]): ToolResult {
  const answer: EditAnswer = { ok: true, revision: deck.revision, runId, elements }
  return { ok: true, deck, answer, content: [{ type: "text", text: JSON.stringify(answer) }] }
}

function addedBox(deck: Deck): { readonly node: ElementId; readonly box: Box } | undefined {
  const last = deck.register.order.at(-1)
  if (last?.slide !== "element-add" || last.element.box === null) return undefined
  return { node: last.element.node, box: last.element.box }
}

export function elementTool(op: ElementOp, raw: unknown, session: Session): ToolResult {
  const before = session.deck
  const parsed = elementReaders[op](raw)
  if (!parsed.ok) return editRefusal(before, parsed.refusal, [])
  const held = heldRun(session)
  const fresh = parsed.base === before.revision
  const stopped =
    held === undefined && fresh ? stopForNewTurn(before, holders(session)) : ({ ok: true, deck: before } as const)
  if (!stopped.ok) return editRefusal(before, stopped.refusal, [])
  const runId = held?.runId ?? session.caller.runId
  const deck = { id: before.id, revision: before.revision, register: stopped.deck.register }
  const result = call(op, deck, { actor: "agent", runId }, raw)
  if (!result.ok) {
    const detail =
      "node" in parsed
        ? deleteDetail(before, parsed.node, result.refusal)
        : result.refusal === "dead"
          ? addDetail(before, parsed.slide)
          : undefined
    return failed(before, result.refusal, detail)
  }
  if ("node" in parsed) return answered(result.deck, runId, [])
  const added = addedBox(result.deck)
  if (added === undefined) return editRefusal(before, "dead", [])
  const text = parsed.text ?? ""
  if (text === "") return answered(result.deck, runId, [{ node: added.node, value: "", version: 0, box: added.box }])
  const written = editDeck(
    { deck: before.id, base: result.deck.revision, changes: [{ value: text, node: added.node, readAt: 0 }] },
    { ...session, deck: result.deck },
  )
  if (!written.ok) return { ...written, deck: before }
  const body = written.deck.register.elements[added.node]
  return answered(written.deck, runId, [
    { node: added.node, value: text, version: body === undefined ? 0 : version(body), box: added.box },
  ])
}
