import { field } from "./intent-fields.js"
import type { CropSides } from "./picture-crop.js"
import { type Reader, accepting, finite, object, reject } from "./read-kit.js"

const cutSide = finite(0, 99)

const readCrop: Reader<CropSides> = (raw) => {
  const cut = object({}, { left: cutSide, top: cutSide, right: cutSide, bottom: cutSide })(raw)
  const sides = { left: cut.left ?? 0, top: cut.top ?? 0, right: cut.right ?? 0, bottom: cut.bottom ?? 0 }
  if (Object.keys(cut).length === 0 || sides.left + sides.right >= 100 || sides.top + sides.bottom >= 100) reject()
  return sides
}

const cropForm = { code: "crop-sides" } as const

export const cropField = field(
  {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      ["left", "top", "right", "bottom"].map((side) => [side, { type: "number", minimum: 0, maximum: 99 }]),
    ),
  },
  accepting(cropForm, readCrop),
)
