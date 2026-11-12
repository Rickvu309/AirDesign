import { readAgentEdit } from "@airdesign/catalog"
import { call } from "@airdesign/engine"
import type { Session, ToolResult } from "./call-tool.js"
import { editLanded, editRefusal, namedNodes } from "./edit-answer.js"
import { elementFloors, joinRun, openRun } from "./run.js"
import { textProblem } from "./text-from.js"
import { heldRun } from "./turn.js"

function startedTurn(raw: unknown, session: Session) {
  const { deck } = session
  const held = heldRun(session)
  if (held !== undefined) return joinRun(deck.register, raw, held.runId)
  return openRun(deck.register, raw, () => session.caller.runId)
}

export function editDeck(raw: unknown, session: Session): ToolResult {
  const before = session.deck
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) return editRefusal(before, parsed.refusal, [])
  if (parsed.deck !== before.id) return editRefusal(before, "deck", [])
  const nodes = namedNodes(parsed.changes)
  const floors = elementFloors(before.register, parsed.changes)
  if (!floors.ok) return editRefusal(before, floors.refusal, nodes)
  const problem = textProblem(floors.floors, parsed.changes)
  if (problem !== undefined) return editRefusal(before, problem.code, nodes, problem.detail)
  const opened = startedTurn(raw, session)
  if (!opened.ok) return editRefusal(before, opened.refusal, nodes)
  const deck = { id: before.id, revision: before.revision, register: opened.register }
  const result = call("edit_deck", deck, opened.caller, raw)
  if (!result.ok) return { ...editRefusal(deck, result.refusal, nodes), deck: before }
  return editLanded(result.deck, nodes, opened.caller.runId)
}
