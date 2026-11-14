import { readTextValue, writeTextValue, type TextValue } from "@airdesign/document"
import { requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { applyRoute } from "./slide-route.js"
import { markupChildren, shapeTextValue } from "./text-value-route.js"
import { whole, type PartCodec, type TraitXml } from "./xml-codec.js"

function shownText(stored: string): TextValue {
  return readTextValue(stored) ?? [{ from: 0, runs: stored === "" ? [] : [{ from: 0, text: stored }] }]
}

function storedText(value: TextValue): string {
  return value.length === 0 ? "" : writeTextValue(value)
}

const textValue: PartCodec<string> = {
  read(parts, at) {
    const bytes = parts.get(at.part)
    if (bytes === undefined) return null
    try {
      const { elements } = requireMarkup(bytes)
      return storedText(shapeTextValue(markupChildren(elements), bytes, shapeById(elements, at.shape)))
    } catch {
      return null
    }
  },
  write: (parts, at, value) =>
    applyRoute(parts, { name: "text", part: at.part, shape: at.shape, value: shownText(value) }),
}

export const textXml: TraitXml<"text"> = { slot: null, fields: { value: whole(textValue) } }
