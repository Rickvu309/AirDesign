import { readCreateDeck, type DeckId } from "@airdesign/catalog"
import { readDeckPage, type ReadDeckAnswer } from "@airdesign/engine"

import type { Session, ToolResult } from "./call-tool.js"
import { editRefusal } from "./edit-answer.js"

export type CreatedDeck = { readonly deck: DeckId; readonly name: string }

export type CreateDeckAnswer = CreatedDeck & ReadDeckAnswer

export function createDeckTool(raw: unknown, session: Session): ToolResult {
  const parsed = readCreateDeck(raw)
  if (!parsed.ok) return editRefusal(session.deck, parsed.refusal, [])
  const created = session.created
  if (created === undefined || created.deck !== session.deck.id) return editRefusal(session.deck, "store", [])
  const { ok, ...read } = readDeckPage(session.deck, { runId: null })
  const reported: CreateDeckAnswer = { ok, deck: created.deck, name: created.name, ...read }
  return {
    ok: true,
    deck: session.deck,
    reported,
    content: [
      { type: "text", text: `Created deck ${created.deck}.` },
      { type: "text", text: JSON.stringify(reported) },
    ],
  }
}
