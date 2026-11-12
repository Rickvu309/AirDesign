import { slideReaders, type SlideOp } from "@airdesign/catalog"
import { call } from "@airdesign/engine"
import type { Session, ToolResult } from "./call-tool.js"
import { editRefusal } from "./edit-answer.js"
import { liveTurn } from "./turn.js"
import { stopLiveRuns } from "./run.js"

export function slideTool(op: SlideOp, raw: unknown, session: Session): ToolResult {
  const before = session.deck
  const parsed = slideReaders[op](raw)
  if (!parsed.ok) return editRefusal(before, parsed.refusal, [])
  const held = liveTurn(session, before.id)
  const stopped = held === undefined ? stopLiveRuns(before) : ({ ok: true, deck: before } as const)
  if (!stopped.ok) return editRefusal(before, stopped.refusal, [])
  const runId = held?.runId ?? session.caller.runId
  const result = call(op, stopped.deck, { actor: "agent", runId }, raw)
  if (!result.ok) {
    if (result.refusal === "indexing") return editRefusal(before, result.refusal, [])
    const named = "slide" in parsed ? `Slide ${parsed.slide}` : `After ${parsed.after}, layout ${parsed.layout}`
    const detail =
      op === "delete_slide"
        ? `${named}: deletion needs a present slide and at least one other slide to keep. Read the deck again and choose a slide from its current order.`
        : op === "move_slide"
          ? `${named}: choose a present slide and a different present slide as after, or null for the beginning. Read the deck again for its current order.`
          : op === "add_slide"
            ? `${named}: both ids must be present, and the layout must be indexed. Open the deck in AirDesign to index it, or choose another slide's layout if its parts cannot create a slide.`
            : `${named}: duplication needs a present slide and a complete index. Open the deck in AirDesign and read it again.`
    return editRefusal(before, result.refusal, [], detail)
  }
  const slide = op === "add_slide" || op === "duplicate_slide" ? result.deck.register.order.at(-1)?.id : undefined
  const answer = {
    ok: true as const,
    revision: result.deck.revision,
    runId,
    elements: [],
    ...(slide === undefined ? {} : { slide }),
  }
  return { ok: true, deck: result.deck, answer, content: [{ type: "text", text: JSON.stringify(answer) }] }
}
