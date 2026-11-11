import type { DeckId } from "@airdesign/catalog"
import type { Session, ToolResult } from "./call-tool.js"

export type Turn = {
  readonly runId: string | null
  readonly lastCall: number
  readonly revision: number
}

export type LiveTurn = Turn & { readonly runId: string }

export type Turns = {
  readonly read: (deck: DeckId) => Turn | undefined
  readonly write: (deck: DeckId, turn: Turn) => void
}

const tenMinutes = 600_000

export function memoryTurns(): Turns {
  const held = new Map<DeckId, Turn>()
  return {
    read: (deck) => held.get(deck),
    write: (deck, turn) => {
      held.set(deck, turn)
    },
  }
}

export function liveTurn(session: Session, deck: DeckId): LiveTurn | undefined {
  const turn = session.turns.read(deck)
  if (turn === undefined || turn.runId === null) return undefined
  if (session.now - turn.lastCall >= (session.idleWindow ?? tenMinutes)) return undefined
  return { ...turn, runId: turn.runId }
}

function endsTurn(op: string): boolean {
  return op === "stop_run" || op === "undo_run"
}

export function settleTurn(op: string, result: ToolResult, session: Session): void {
  if (!result.ok) return
  const deck = session.deck.id
  const held = session.turns.read(deck)
  const answer = result.answer?.ok === true ? result.answer : undefined
  if (answer !== undefined && (held === undefined || answer.revision >= held.revision)) {
    const { revision, runId } = answer
    if (op === "edit_deck") {
      session.turns.write(deck, { runId, lastCall: session.now, revision })
      return
    }
    if (endsTurn(op) && runId === held?.runId) {
      session.turns.write(deck, { runId: null, lastCall: session.now, revision })
      return
    }
  }
  const turn = liveTurn(session, deck)
  if (turn !== undefined) session.turns.write(deck, { ...turn, lastCall: Math.max(turn.lastCall, session.now) })
}
