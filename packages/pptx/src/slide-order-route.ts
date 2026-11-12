import {
  foldSections,
  foldSlides,
  presentSlides,
  shapeOf,
  type SlideCommand,
  type SlideState,
} from "@airdesign/document"

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

function elementEdited(
  parts: ReadonlyMap<string, Uint8Array>,
  minted: ReadonlyMap<string, string>,
  command: Extract<SlideCommand, { readonly slide: "element-add" | "element-remove" }>,
): ReadonlyMap<string, Uint8Array> {
  const part = slidePart(parts, minted.get(command.id) ?? "")
  if (part === null) throw new Error("slide")
  if (command.slide === "element-remove")
    return applyRoute(parts, { name: "remove", part, shape: shapeOf(command.node).shape })
  const { node, box } = command.element
  if (box === null) throw new Error("box")
  return applyRoute(parts, { name: "add", part, id: Number(shapeOf(node).shape), text: "", ...box })
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
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const command of state.order) {
    if (command.slide === "element-add" || command.slide === "element-remove") {
      next = elementEdited(next, minted, command)
      continue
    }
    if (command.slide !== "add" && command.slide !== "clone") continue
    const anchorId = minted.get(command.slide === "add" ? command.after : command.source)
    if (anchorId === undefined) throw new Error("slide")
    const before = idsOf(next)
    const route =
      command.slide === "add"
        ? ({ name: "sldIdLst.add", after: anchorId, id: command.id } as const)
        : ({ name: "sldIdLst.clone", slide: anchorId, id: command.id } as const)
    next = applyStructuralRoute(next, route)
    const id = createdId(before, idsOf(next))
    minted.set(command.id, id)
    if (command.slide !== "add") continue
    const born = slidePart(next, id)
    const layoutSlide = slidePart(next, minted.get(command.layout) ?? "")
    const layout = born === null || layoutSlide === null ? null : layoutPart(next, layoutSlide)
    if (born !== null && layout !== null) next = withLayoutPlaceholders(next, born, layout)
  }
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
