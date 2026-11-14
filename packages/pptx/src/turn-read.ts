import { inheritedSlot, slotAt } from "./inherited-slot.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { angle, flag, type AttributeCodec, type ElementAt, type Parts } from "./xml-codec.js"

export type ShownTurn = { readonly rot: number; readonly flipH: boolean; readonly flipV: boolean }

function attributeOf<V>(slot: Uint8Array | null, name: string, codec: AttributeCodec<V>, absent: V): V {
  const root = slot === null ? undefined : requireMarkup(slot).elements[0]
  const text = root?.attributes.find((attribute) => attribute.name === name)?.value
  return text === undefined ? absent : (codec.read(text) ?? absent)
}

export function shownTurn(parts: Parts, at: ElementAt): ShownTurn {
  const bytes = partBytes(parts, at.part)
  const place = slotAt(bytes, at.shape, "transform")
  const slot =
    place.own === null ? inheritedSlot(parts, at, "transform") : bytes.subarray(place.own.start, place.own.end)
  return {
    rot: attributeOf(slot, "rot", angle, 0),
    flipH: attributeOf(slot, "flipH", flag, false),
    flipV: attributeOf(slot, "flipV", flag, false),
  }
}
