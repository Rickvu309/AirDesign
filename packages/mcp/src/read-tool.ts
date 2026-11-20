import { readDeckQuery, readListDecks } from "@airdesign/catalog"
import { listLead, pageOwned, readDeckPage, readLead } from "@airdesign/engine"

import type { Session, ToolResult } from "./call-tool.js"
import { editRefusal } from "./edit-answer.js"

export function readDeckTool(raw: unknown, session: Session, runId: string | null): ToolResult {
  const before = session.deck
  const parsed = readDeckQuery(raw)
  if (!parsed.ok) return editRefusal(before, parsed.refusal, [])
  if (parsed.deck !== before.id) return editRefusal(before, "deck", [])
  const reported = readDeckPage(before, {
    runId,
    ...(parsed.slide === undefined ? {} : { slide: parsed.slide }),
    ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
    ...(session.findings?.deck === before.id ? { findings: session.findings } : {}),
  })
  const lead = readLead(reported.revision)
  return {
    ok: true,
    deck: before,
    reported,
    content: [
      { type: "text", text: lead },
      { type: "text", text: JSON.stringify(reported) },
    ],
  }
}

export function listDecksTool(raw: unknown, session: Session): ToolResult {
  const parsed = readListDecks(raw)
  if (!parsed.ok) return editRefusal(session.deck, parsed.refusal, [])
  const reported = pageOwned(session.owned ?? [], parsed.cursor)
  return {
    ok: true,
    deck: session.deck,
    reported,
    content: [
      { type: "text", text: listLead },
      { type: "text", text: JSON.stringify(reported) },
    ],
  }
}
