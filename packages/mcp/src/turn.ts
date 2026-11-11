import type { DeckId } from "@airdesign/catalog"
import type { Session, ToolResult } from "./call-tool.js"

export type Turn = {
  readonly runId: string
  readonly lastCall: number
}

export type Turns = {
  readonly read: (deck: DeckId) => Turn | undefined
  readonly write: (deck: DeckId, turn: Turn) => void
  readonly clear: (deck: DeckId) => void
}

const tenMinutes = 600_000

export function memoryTurns(): Turns {
  const held = new Map<DeckId, Turn>()
  return {
    read: (deck) => held.get(deck),
    write: (deck, turn) => {
      held.set(deck, turn)
    },
    clear: (deck) => {
      held.delete(deck)
    },
  }
}

export function liveTurn(session: Session, deck: DeckId): Turn | undefined {
  const turn = session.turns.read(deck)
  if (turn === undefined) return undefined
  if (session.now - turn.lastCall >= (session.idleWindow ?? tenMinutes)) return undefined
  return turn
}

export function settleTurn(op: string, result: ToolResult, session: Session): void {
  const deck = session.deck.id
  const runId = result.answer?.ok === true ? result.answer.runId : undefined
  if (op === "edit_deck" && runId !== undefined) {
    session.turns.write(deck, { runId, lastCall: session.now })
    return
  }
  if (op === "stop_run" && runId !== undefined && runId === session.turns.read(deck)?.runId) {
    session.turns.clear(deck)
    return
  }
  const turn = liveTurn(session, deck)
  if (turn !== undefined) session.turns.write(deck, { ...turn, lastCall: session.now })
}
