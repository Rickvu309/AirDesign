import { spliceBytes } from "./element-span.js"
import { sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { nonVisualOf, shownIdentity, type ShownIdentity } from "./picture-read.js"
import { attributeEdit } from "./markup-attribute.js"
import { lockedWritten, shownLocked } from "./shape-locks.js"
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

function shown<K extends keyof ShownIdentity>(key: K) {
  return (parts: Parts, at: ElementAt): ShownIdentity[K] | null => shownIdentity(parts, at)?.[key] ?? null
}

export const identityXml: TraitXml<"identity"> = {
  slot: null,
  fields: {
    name: whole({ read: shown("name"), write: written("name", (value: string) => value) }),
    alt: whole({ read: shown("alt"), write: written("descr", (value: string) => (value === "" ? null : value)) }),
    hidden: whole({ read: shown("hidden"), write: written("hidden", (value: boolean) => (value ? "1" : null)) }),
    locked: whole({ read: shownLocked, write: lockedWritten }),
  },
}
