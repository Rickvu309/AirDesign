import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { nonVisualOf, shownIdentity, type ShownIdentity } from "./picture-read.js"
import { xmlText } from "./shape-write.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

const space = new Set([0x20, 0x09, 0x0a, 0x0d])

function attributeStart(bytes: Uint8Array, valueStart: number, name: string): number {
  let at = valueStart - 2
  while (at > 0 && space.has(bytes[at] ?? 0)) at -= 1
  at -= 1
  while (at > 0 && space.has(bytes[at] ?? 0)) at -= 1
  at -= name.length - 1
  while (at > 0 && space.has(bytes[at - 1] ?? 0)) at -= 1
  return at
}

function attributeEdit(bytes: Uint8Array, element: MarkupElement, name: string, value: string | null): ByteEdit | null {
  const held = element.attributes.find((each) => each.name === name)
  const quoted =
    value === null
      ? ""
      : xmlText(value)
          .replaceAll('"', "&quot;")
          .replaceAll("\n", "&#xA;")
          .replaceAll("\r", "&#xD;")
          .replaceAll("\t", "&#x9;")
  if (held !== undefined && value !== null)
    return { start: held.valueStart, end: held.valueEnd, next: encodeUtf8(quoted) }
  if (held !== undefined)
    return { start: attributeStart(bytes, held.valueStart, name), end: held.valueEnd + 1, next: new Uint8Array() }
  if (value === null) return null
  const at = element.openEnd - (element.selfClosing ? 2 : 1)
  return { start: at, end: at, next: encodeUtf8(` ${name}="${quoted}"`) }
}

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
  },
}
