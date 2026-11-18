import type { ByteEdit, MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { xmlText } from "./shape-write.js"

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

export function attributeEdit(
  bytes: Uint8Array,
  element: MarkupElement,
  name: string,
  value: string | null,
): ByteEdit | null {
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
