import type { UndoStays } from "@/copy/agent-runs-copy"
import { type AiraChat, airaStep } from "./aira-loop"

export type RunUndone = (UndoStays & { readonly undone: boolean }) | "refused" | "failed"
export type UndoRun = (deck: string, run: string) => Promise<RunUndone>

export async function undoExchange(chat: AiraChat, exchange: number, undo: UndoRun): Promise<AiraChat | undefined> {
  const found = chat.exchanges[exchange]
  if (
    found === undefined ||
    found.end === "working" ||
    found.end === "undone" ||
    found.undoRefused === true ||
    found.runs.length === 0
  ) {
    return undefined
  }
  const kept: string[] = []
  const left: string[] = []
  const waiting: string[] = []
  let undone = true
  for (const [index, runId] of [...found.runs].reverse().entries()) {
    const failed = airaStep(chat, {
      type: "undo-failed",
      exchange,
      runs: found.runs.slice(0, found.runs.length - index),
    })
    const result = await undo(chat.deck, runId)
    if (result === "refused") return airaStep(chat, { type: "undo-refused", exchange })
    if (result === "failed") return failed
    kept.push(...result.kept.filter((layer) => !kept.includes(layer)))
    left.push(...result.left.filter((layer) => !left.includes(layer)))
    waiting.push(...result.waiting.filter((layer) => !waiting.includes(layer)))
    undone &&= result.undone
  }
  return airaStep(chat, { type: undone ? "undone" : "undo-stays", exchange, kept, left, waiting })
}
