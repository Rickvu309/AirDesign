import {
  floorNodes,
  followsGroups,
  layoutNodes,
  opaque,
  readLayout,
  shownPlace,
  type Box,
  type ElementId,
  type Register,
} from "@airdesign/document"
import type { ReadElement } from "./read-deck.js"

type Frame = { readonly frame: "auto" | "free"; readonly backdrop: ElementId; readonly opacity: number }

export type ReadFrames = {
  readonly boxes: ReadonlyMap<ElementId, Box>
  readonly frames: ReadonlyMap<ElementId, Frame>
  readonly backdrops: ReadonlySet<ElementId>
}

const read = new WeakMap<Register, ReadFrames>()

export function readFrames(register: Register): ReadFrames {
  const kept = read.get(register)
  if (kept !== undefined) return kept
  const boxes = new Map<ElementId, Box>()
  const frames = new Map<ElementId, Frame>()
  const backdrops = new Set<ElementId>()
  for (const node of layoutNodes(register)) {
    const view = readLayout(register, node)
    if (view === null) continue
    frames.set(node, { frame: view.flow === "none" ? "free" : "auto", backdrop: view.backdrop, opacity: view.opacity })
    backdrops.add(view.backdrop)
    boxes.set(node, view.box)
    for (const child of view.children) boxes.set(child.node, child.box)
  }
  for (const node of [...(register.index?.elements.map((element) => element.node) ?? []), ...floorNodes(register)]) {
    const shown = boxes.has(node) || !followsGroups(register, node) ? null : shownPlace(register, node)
    if (shown !== null) boxes.set(node, shown.box)
  }
  const found = { boxes, frames, backdrops }
  read.set(register, found)
  return found
}

export function framedElement(
  element: ReadElement,
  framed: ReadFrames,
  shown: (node: ElementId) => ReadElement,
): ReadElement {
  const box = framed.boxes.get(element.node)
  const laid = box === undefined ? element : { ...element, box }
  const frame = framed.frames.get(element.node)
  if (frame === undefined) return laid
  const faded = frame.opacity < opaque ? `opacity ${String(frame.opacity / 1000)}` : undefined
  const design = [faded, laid.design, shown(frame.backdrop).design].filter((line) => line !== undefined).join(" · ")
  return { ...laid, frame: frame.frame, ...(design === "" ? {} : { design }) }
}
