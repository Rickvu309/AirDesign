import { markupDocument, spliceBytes, type MarkupElement } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { whole, type TraitXml } from "./xml-codec.js"
import { slideAddresses } from "./package-address.js"
import { readPlayback, type PlayedKind, type PlayedTransition } from "./transition-read.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type TransitionKind = PlayedKind

export type SlideTransition = PlayedTransition

export type SlideShow = {
  readonly slide: string
  readonly part: string
  readonly hidden: boolean
  readonly transition: SlideTransition | null
  readonly advance: number | null
}

function attr(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((attribute) => attribute.name === name)?.value
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
    const playback = readPlayback(bytes)
    return [
      {
        slide,
        part,
        hidden: slideSkipped(document.elements[0]),
        transition: playback.transition,
        advance: playback.advance,
      },
    ]
  })
}
