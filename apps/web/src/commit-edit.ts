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

export type FlushOutcome = "sent" | "offline" | "signed-out" | "kept" | "set-aside"

export type CommitOutcome = FlushOutcome | "refused"

const unread: ReadonlySet<unknown> = new Set(["payload", "server"])

export async function flushPending(open: (remote: Remote) => FlushLink, deckId: string): Promise<FlushOutcome> {
  try {
    const flushed = await open(server).flush(deckId)
    if (typeof flushed !== "object" || flushed === null) return "kept"
    if ("aside" in flushed && typeof flushed.aside === "number" && flushed.aside > 0) return "set-aside"
    if ("ok" in flushed && flushed.ok === true) return "sent"
    if ("refusal" in flushed && flushed.refusal === "session") return "signed-out"
    if ("refusal" in flushed && unread.has(flushed.refusal)) return "offline"
    return "kept"
  } catch (error) {
    return error instanceof TypeError ? "offline" : "kept"
  }
}

type Paint = () => Promise<void> | void

export function commitEdit(
  open: (remote: Remote) => EditLink,
  deckId: string,
  value: string,
  box: TextBox,
  paint?: Paint,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  return commitKept(open, deckId, open(memoryRemote()).enqueue(deckId, value, box.id, box.file), paint, refused)
}

export function commitBox(
  open: (remote: Remote) => BoxLink,
  deckId: string,
  box: Box,
  element: TextBox,
  paint?: Paint,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  return commitKept(
    open,
    deckId,
    open(memoryRemote()).enqueueBox(deckId, box, element.id, element.file),
    paint,
    refused,
  )
}

export async function commitKept(
  open: (remote: Remote) => FlushLink,
  deckId: string,
  kept: Promise<{ readonly ok: boolean }>,
  paint?: Paint,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  if (!(await kept).ok) {
    await refused?.()
    return "refused"
  }
  await paint?.()
  return flushPending(open, deckId)
}
