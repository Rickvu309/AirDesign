import type { IndexElement } from "./deck-index.js"
import { shapeOf } from "./element-id.js"

export const oneInch = 914_400

const emuPerPoint = 12_700
const iconPerText = 1.5

export function iconSideOn(elements: readonly IndexElement[], slide: string): number {
  const sizes = elements
    .filter((element) => shapeOf(element.node).slide === slide)
    .flatMap((element) => {
      const size = element.design?.["text.size"]?.[0]
      return typeof size === "number" && size > 0 ? [size] : []
    })
    .sort((left, right) => left - right)
  const body = sizes[Math.floor((sizes.length - 1) / 2)]
  return body === undefined ? oneInch : Math.round(body * iconPerText * emuPerPoint)
}
