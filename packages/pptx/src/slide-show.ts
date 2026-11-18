import { markupDocument, spliceBytes, type MarkupElement } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { whole, type TraitXml } from "./xml-codec.js"
import { slideAddresses } from "./package-address.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type TransitionKind = "fade" | "push" | "wipe"

export type SlideTransition = {
  readonly kind: TransitionKind
  readonly direction: string | null
  readonly duration: number
}

export type SlideShow = {
  readonly slide: string
  readonly part: string
  readonly hidden: boolean
  readonly transition: SlideTransition | null
}

const kinds: Readonly<Record<string, TransitionKind>> = { "p:fade": "fade", "p:push": "push", "p:wipe": "wipe" }

const speeds: Readonly<Record<string, number>> = { fast: 500, med: 750, slow: 1000 }

function attr(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((attribute) => attribute.name === name)?.value
}

function durationOf(transition: MarkupElement): number {
  const exact = Number(attr(transition, "p14:dur"))
  if (Number.isFinite(exact) && exact > 0) return exact
  return speeds[attr(transition, "spd") ?? "fast"] ?? speeds.fast!
}

function transitionOf(elements: readonly MarkupElement[]): SlideTransition | null {
  for (const transition of elements) {
    if (transition.kind !== "p:transition") continue
    const effect = elements.find((element) => element.parent === transition.index)
    const kind = effect === undefined ? undefined : kinds[effect.kind]
    if (effect === undefined || kind === undefined) continue
    const direction = kind === "fade" ? null : (attr(effect, "dir") ?? "l")
    return { kind, direction, duration: durationOf(transition) }
  }
  return null
}

export function slideSkipped(root: MarkupElement | undefined): boolean {
  const show = root?.kind === "p:sld" ? attr(root, "show") : undefined
  return show === "0" || show === "false"
}

function writeSkipped(parts: Parts, part: string, skipped: boolean): Parts {
  const bytes = partBytes(parts, part)
  const [root] = requireMarkup(bytes).elements
  if (root?.kind !== "p:sld") throw new Error("show-slide")
  const edit = attributeEdit(bytes, root, "show", skipped ? "0" : null)
  return edit === null ? parts : new Map(parts).set(part, spliceBytes(bytes, [edit]))
}

export const showXml: TraitXml<"show"> = {
  slot: null,
  fields: {
    skipped: whole({
      read: (parts, at) => slideSkipped(requireMarkup(partBytes(parts, at.part)).elements[0]),
      write: (parts, at, skipped) => writeSkipped(parts, at.part, skipped),
    }),
  },
}

export function readShows(parts: Parts): readonly SlideShow[] {
  return slideAddresses(parts).flatMap(({ slide, part }) => {
    const bytes = parts.get(part)
    if (bytes === undefined) return []
    const document = markupDocument(bytes)
    return [
      {
        slide,
        part,
        hidden: slideSkipped(document.elements[0]),
        transition: document.wellFormed ? transitionOf(document.elements) : null,
      },
    ]
  })
}
