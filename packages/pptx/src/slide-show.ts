import { spliceBytes, type MarkupElement } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { whole, type TraitXml } from "./xml-codec.js"
import { type PlayedTransition } from "./transition-read.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type SlideTransition = PlayedTransition

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
