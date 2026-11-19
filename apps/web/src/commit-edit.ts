import { bytesOf, limits, type Box, type ElementId } from "@airdesign/document"
import { httpRemote, memoryRemote, type Remote } from "@airdesign/live"

export type TextBox = { readonly id: ElementId; readonly file: string }

type FlushLink = {
  flush(deck: string): Promise<unknown>
  pending(deck: string): Promise<readonly unknown[]>
}

type Kept = { readonly ok: boolean; readonly refusal?: string }

type EditLink = FlushLink & {
  enqueue(deck: string, value: string, node: ElementId, floor: string): Promise<Kept>
}

type BoxLink = FlushLink & {
  enqueueBox(deck: string, box: Box, node: ElementId, floor: string): Promise<Kept>
}

export const server = httpRemote()

export type SaveRefusal = "storage" | "size"

export type FlushOutcome =
  | "sent"
  | "offline"
  | "signed-out"
  | "kept"
  | "set-aside"
  | "set-aside-too-large"
  | SaveRefusal

export type CommitOutcome = FlushOutcome | "refused" | "too-large"

export async function flushPending(open: (remote: Remote) => FlushLink, deckId: string): Promise<FlushOutcome> {
  try {
    const link = open(server)
    const flushed = await link.flush(deckId)
    if (typeof flushed !== "object" || flushed === null) return "kept"
    if ("aside" in flushed && typeof flushed.aside === "number" && flushed.aside > 0) {
      const allTooLarge = "asideTooLarge" in flushed && flushed.asideTooLarge === flushed.aside
      return allTooLarge ? "set-aside-too-large" : "set-aside"
    }
    if ("refusal" in flushed && flushed.refusal === "session") return "signed-out"
    if ("refusal" in flushed && (flushed.refusal === "storage" || flushed.refusal === "size")) return flushed.refusal
    return (await link.pending(deckId)).length === 0 ? "sent" : "kept"
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
  const kept = open(memoryRemote())
    .enqueue(deckId, value, box.id, box.file)
    .then((result) =>
      !result.ok && result.refusal === "limit" && bytesOf(value) > limits.valueBytes
        ? { ...result, refusal: "size" }
        : result,
    )
  return commitKept(open, deckId, kept, paint, refused)
}

export type BoxCommit = { readonly box: Box; readonly element: TextBox }

export async function commitBoxes(
  open: (remote: Remote) => BoxLink,
  deckId: string,
  boxes: readonly BoxCommit[],
  paint: (kept: readonly ElementId[]) => Promise<void> | void,
  refused: (node: ElementId) => Promise<void> | void,
): Promise<CommitOutcome> {
  const kept: ElementId[] = []
  let refusal: CommitOutcome = "refused"
  for (const { box, element } of boxes) {
    const result = await open(memoryRemote()).enqueueBox(deckId, box, element.id, element.file)
    if (result.ok) kept.push(element.id)
    else {
      if (result.refusal === "size") refusal = "too-large"
      await refused(element.id)
    }
  }
  if (kept.length === 0) return refusal
  await paint(kept)
  return flushPending(open, deckId)
}

export async function commitKept(
  open: (remote: Remote) => FlushLink,
  deckId: string,
  kept: Promise<Kept>,
  paint?: Paint,
  refused?: () => Promise<void> | void,
): Promise<CommitOutcome> {
  const result = await kept
  if (!result.ok) {
    await refused?.()
    return result.refusal === "size" ? "too-large" : "refused"
  }
  await paint?.()
  return flushPending(open, deckId)
}
