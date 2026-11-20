import {
  boxPatch,
  bytesOf,
  format,
  limits,
  type Box,
  type ElementId,
  type ElementPatch,
  type Preset,
  type Row,
  type Sides,
  sidesPatch,
  type TraitPatch,
} from "@airdesign/document"
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
  enqueueRow(deck: string, row: Row, node: ElementId, floor: string): Promise<Kept>
}

export const server = httpRemote()

export type SaveRefusal = "storage" | "size"

export type FlushOutcome =
  | "sent"
  | "offline"
  | "signed-out"
  | "kept"
  | "empty"
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
    if ((await link.pending(deckId)).length === 0) return "sent"
    return "empty" in flushed && flushed.empty === true ? "empty" : "kept"
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

export type CornersShape = { readonly preset: Preset; readonly adjust: Readonly<Record<string, number>> }

export type TextSizing = TraitPatch<"body">

export type BoxCommit = {
  readonly box: Box
  readonly element: TextBox
  readonly corners?: { readonly before: CornersShape; readonly after: CornersShape }
  readonly sizing?: { readonly before: TextSizing; readonly after: TextSizing }
  readonly sides?: { readonly before: Sides; readonly after: Sides }
  readonly laidOut?: true
}

export function commitPatch(
  box: Box,
  commit: Omit<BoxCommit, "box" | "element">,
  side: "before" | "after",
): ElementPatch {
  const placed = commit.laidOut === true ? { box: { w: { set: box.cx }, h: { set: box.cy } } } : boxPatch(box)
  const sized = { ...placed, ...sidesPatch(commit.sides?.[side] ?? {}) }
  const shape = commit.corners?.[side]
  const cornered = shape === undefined ? sized : { ...sized, geometry: { shape: { set: shape } } }
  const text = commit.sizing?.[side]
  return text === undefined ? cornered : { ...cornered, body: text }
}

export async function storeBoxes(
  open: (remote: Remote) => BoxLink,
  deckId: string,
  boxes: readonly BoxCommit[],
  paint: (kept: readonly ElementId[]) => Promise<void> | void,
  refused: (node: ElementId) => Promise<void> | void,
): Promise<CommitOutcome | "stored"> {
  const kept: ElementId[] = []
  let refusal: CommitOutcome = "refused"
  for (const commit of boxes) {
    const { box, element } = commit
    const link = open(memoryRemote())
    const plain = Object.keys(commit).every((key) => key === "box" || key === "element")
    const result = plain
      ? await link.enqueueBox(deckId, box, element.id, element.file)
      : await link.enqueueRow(deckId, { v: format, patch: commitPatch(box, commit, "after") }, element.id, element.file)
    if (result.ok) kept.push(element.id)
    else {
      if (result.refusal === "size") refusal = "too-large"
      await refused(element.id)
    }
  }
  if (kept.length === 0) return refusal
  await paint(kept)
  return "stored"
}

export async function commitBoxes(
  open: (remote: Remote) => BoxLink,
  deckId: string,
  boxes: readonly BoxCommit[],
  paint: (kept: readonly ElementId[]) => Promise<void> | void,
  refused: (node: ElementId) => Promise<void> | void,
): Promise<CommitOutcome> {
  const stored = await storeBoxes(open, deckId, boxes, paint, refused)
  return stored === "stored" ? flushPending(open, deckId) : stored
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
