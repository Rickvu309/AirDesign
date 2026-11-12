import type { Box, ElementId } from "@airdesign/document"
import { httpRemote, memoryRemote, type Remote } from "@airdesign/live"

export type TextBox = { readonly id: ElementId; readonly file: string }

type FlushLink = { flush(deck: string): Promise<unknown> }

type EditLink = FlushLink & {
  enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<{ readonly ok: boolean }>
}

type BoxLink = FlushLink & {
  enqueueBox(deck: string, box: Box, node: ElementId, floor: string): Promise<{ readonly ok: boolean }>
}

export const server = httpRemote()

export type FlushOutcome = "sent" | "offline" | "signed-out" | "kept"

export type CommitOutcome = FlushOutcome | "refused"

export async function flushPending(open: (remote: Remote) => FlushLink, deckId: string): Promise<FlushOutcome> {
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
  const kept = await open(memoryRemote()).enqueue(deckId, value, box.id, box.file)
  return sendKept(kept.ok, open, deckId, paint, refused)
}

export async function commitBox(
  open: (remote: Remote) => BoxLink,
  deckId: string,
  box: Box,
  element: TextBox,
  paint?: () => void,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  const kept = await open(memoryRemote()).enqueueBox(deckId, box, element.id, element.file)
  return sendKept(kept.ok, open, deckId, paint, refused)
}

async function sendKept(
  kept: boolean,
  open: (remote: Remote) => FlushLink,
  deckId: string,
  paint?: () => void,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  if (!kept) {
    await refused?.()
    return "refused"
  }
  paint?.()
  return flushPending(open, deckId)
}
