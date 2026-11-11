import type { ElementId } from "@airdesign/document"
import { httpRemote, memoryRemote, type Remote } from "@airdesign/live"

export type TextBox = { readonly id: ElementId; readonly file: string }

type EditLink = {
  enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<{ readonly ok: boolean }>
  flush(deck: string): Promise<unknown>
}

export const server = httpRemote()

export type FlushOutcome = "sent" | "offline" | "signed-out" | "kept"

export type CommitOutcome = FlushOutcome | "refused"

export async function flushPending(open: (remote: Remote) => EditLink, deckId: string): Promise<FlushOutcome> {
  try {
    const flushed = await open(server).flush(deckId)
    if (typeof flushed !== "object" || flushed === null) return "kept"
    if ("ok" in flushed && flushed.ok === true) return "sent"
    if ("refusal" in flushed && flushed.refusal === "session") return "signed-out"
    return "kept"
  } catch (error) {
    return error instanceof TypeError ? "offline" : "kept"
  }
}

export async function commitEdit(
  open: (remote: Remote) => EditLink,
  deckId: string,
  value: string,
  box: TextBox,
  paint?: () => void,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  const result = await open(memoryRemote()).enqueue(deckId, value, box.id, box.file)
  if (!result.ok) {
    await refused?.()
    return "refused"
  }
  paint?.()
  return flushPending(open, deckId)
}
