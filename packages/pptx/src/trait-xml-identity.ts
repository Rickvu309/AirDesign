import { decodedXmlText, spliceBytes } from "./element-span.js"
import { sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { nonVisualOf } from "./picture-read.js"
import { attributeEdit } from "./markup-attribute.js"
import { lockedWritten, shownLocked } from "./shape-locks.js"
import { maskWritten, shownMask } from "./mask-extension.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

function written<V>(name: string, text: (value: V) => string | null) {
  return (parts: Parts, at: ElementAt, value: V): Parts => {
    const bytes = partBytes(parts, at.part)
    const element = nonVisualOf(requireMarkup(bytes).elements, at.shape)
    if (element === undefined) throw new Error("p:cNvPr")
    const edit = attributeEdit(bytes, element, name, text(value))
    const next = edit === null ? bytes : spliceBytes(bytes, [edit])
    if (sameBytes(next, bytes)) return parts
    const changed = new Map(parts)
    changed.set(at.part, next)
    return changed
  }
}

function readTextAttribute(parts: Parts, at: ElementAt, name: string): string | null {
  const bytes = parts.get(at.part)
  const element = bytes === undefined ? undefined : nonVisualOf(requireMarkup(bytes).elements, at.shape)
  if (element === undefined) return null
  const found = element.attributes.find((each) => each.name === name)
  return found === undefined ? "" : decodedXmlText(found.value)
}

function readHidden(parts: Parts, at: ElementAt): boolean | null {
  const value = readTextAttribute(parts, at, "hidden")
  return value === null ? null : value === "1" || value === "true"
}

export const identityXml: TraitXml<"identity"> = {
  slot: null,
  fields: {
    name: whole({
      read: (parts, at) => readTextAttribute(parts, at, "name"),
      write: written("name", (value: string) => value),
    }),
    alt: whole({
      read: (parts, at) => readTextAttribute(parts, at, "descr"),
      write: written("descr", (value: string) => (value === "" ? null : value)),
    }),
    hidden: whole({ read: readHidden, write: written("hidden", (value: boolean) => (value ? "1" : null)) }),
    locked: whole({ read: shownLocked, write: lockedWritten }),
    mask: whole({ read: shownMask, write: maskWritten }),
  },
}
