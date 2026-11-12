import {
  elementCommand,
  foldSections,
  foldSlides,
  presentSlides,
  shapeOf,
  type ElementCommand,
  type IndexElement,
  type SlideCommand,
  type SlideId,
  type SlideState,
} from "@airdesign/document"

import { deckLayouts } from "./deck-layouts.js"
import { presentationPart, slideAddresses, slidePart } from "./package-address.js"
import { editPart } from "./part-markup.js"
import { readSections } from "./section-read.js"
import { writeSectionSlides } from "./section-write.js"
import { layoutPart, withLayoutPlaceholders } from "./slide-placeholders.js"
import { applyRoute } from "./slide-route.js"
import { applyStructuralRoute } from "./structural-route.js"

function idsOf(parts: ReadonlyMap<string, Uint8Array>): string[] {
  return slideAddresses(parts).map((address) => address.slide)
}

function createdId(before: readonly string[], after: readonly string[]): string {
  const seen = new Set(before)
  const created = after.filter((id) => !seen.has(id))
  const id = created.length === 1 ? created[0] : undefined
  if (id === undefined) throw new Error("slide")
  return id
}

function placed(parts: ReadonlyMap<string, Uint8Array>, wanted: readonly string[]): ReadonlyMap<string, Uint8Array> {
  let next = parts
  for (let index = 0; index < wanted.length; index += 1) {
    const addresses = idsOf(next)
    const wantedId = wanted[index]
    if (wantedId === undefined || addresses[index] === wantedId) continue
    const before = addresses[index]
    if (before === undefined) throw new Error("slide")
    next = applyStructuralRoute(next, { name: "sldIdLst.order", slide: wantedId, before })
  }
  return next
}

type Shown = { readonly start: boolean; readonly now: boolean; readonly element?: IndexElement }

type Pending = Map<SlideId, Map<string, Shown>>

function pendingAfter(pending: Pending, command: ElementCommand): void {
  const shapes = pending.get(command.id) ?? new Map<string, Shown>()
  pending.set(command.id, shapes)
  if (command.slide === "element-add") {
    shapes.set(shapeOf(command.element.node).shape, { start: false, now: true, element: command.element })
    return
  }
  const shape = shapeOf(command.node).shape
  const kept = shapes.get(shape) ?? { start: true, now: true }
  shapes.set(shape, { ...kept, now: command.slide === "element-restore" })
}

function elementsShown(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  shapes: ReadonlyMap<string, Shown> | undefined,
): ReadonlyMap<string, Uint8Array> {
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("slide")
  let next = parts
  for (const [shape, shown] of shapes ?? []) {
    if (shown.start === shown.now) continue
    if (!shown.now) {
      next = applyRoute(next, { name: "remove", part, shape })
      continue
    }
    const box = shown.element?.box ?? null
    if (box === null) throw new Error("box")
    next = applyRoute(next, { name: "add", part, id: Number(shape), text: "", ...box })
  }
  return next
}

function needed(state: SlideState): ReadonlySet<SlideId> {
  const kept = new Set<SlideId>(presentSlides(state).map((spot) => spot.id))
  for (const command of state.order.toReversed()) {
    if (!kept.has(command.id)) continue
    if (command.slide === "add") kept.add(command.after).add(command.layout)
    if (command.slide === "clone") kept.add(command.source)
  }
  return kept
}

function chosenLayout(
  parts: ReadonlyMap<string, Uint8Array>,
  minted: ReadonlyMap<string, string>,
  command: Extract<SlideCommand, { readonly slide: "add" }>,
): string | null {
  if (command.layoutPart !== undefined && deckLayouts(parts).some((layout) => layout.part === command.layoutPart)) {
    return command.layoutPart
  }
  const layoutSlide = slidePart(parts, minted.get(command.layout) ?? "")
  return layoutSlide === null ? null : layoutPart(parts, layoutSlide)
}

function withSectionSlides(
  parts: ReadonlyMap<string, Uint8Array>,
  original: ReadonlyMap<string, Uint8Array>,
  state: SlideState,
  minted: ReadonlyMap<string, string>,
): ReadonlyMap<string, Uint8Array> {
  const sections = foldSections(state, readSections(original))
  if (sections.length === 0) return parts
  const next = new Map(parts)
  editPart(next, presentationPart, (bytes) =>
    writeSectionSlides(
      bytes,
      sections.map((section) => section.slides.map((id) => minted.get(id) ?? id)),
    ),
  )
  return next
}

export function orderedParts(
  parts: ReadonlyMap<string, Uint8Array>,
  state: SlideState,
): ReadonlyMap<string, Uint8Array> {
  if (state.order.length === 0) return parts
  const minted = new Map<string, string>(state.file.map((id) => [id, id]))
  const kept = needed(state)
  const pending: Pending = new Map()
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const command of state.order) {
    if (!kept.has(command.id)) continue
    if (elementCommand(command)) {
      pendingAfter(pending, command)
      continue
    }
    if (command.slide !== "add" && command.slide !== "clone") continue
    const anchorId = minted.get(command.slide === "add" ? command.after : command.source)
    if (anchorId === undefined) throw new Error("slide")
    const before = idsOf(next)
    const layout = command.slide === "add" ? chosenLayout(next, minted, command) : null
    const route =
      command.slide === "add"
        ? ({ name: "sldIdLst.add", after: anchorId, id: command.id, ...(layout === null ? {} : { layout }) } as const)
        : ({ name: "sldIdLst.clone", slide: anchorId, id: command.id } as const)
    next = applyStructuralRoute(next, route)
    const id = createdId(before, idsOf(next))
    minted.set(command.id, id)
    if (command.slide === "clone") {
      next = elementsShown(next, id, pending.get(command.source))
      continue
    }
    const born = slidePart(next, id)
    if (born !== null && layout !== null) next = withLayoutPlaceholders(next, born, layout)
  }
  for (const [slide, shapes] of pending) next = elementsShown(next, minted.get(slide) ?? "", shapes)
  for (const spot of foldSlides(state)) {
    if (spot.present) continue
    const id = minted.get(spot.id)
    if (id === undefined) continue
    next = applyStructuralRoute(next, { name: "sldIdLst.remove", slide: id })
    minted.delete(spot.id)
  }
  const wanted: string[] = []
  for (const spot of presentSlides(state)) {
    const id = minted.get(spot.id)
    if (id === undefined) throw new Error("slide")
    wanted.push(id)
  }
  return withSectionSlides(placed(next, wanted), parts, state, minted)
}
