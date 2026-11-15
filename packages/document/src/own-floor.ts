import type { IndexElement } from "./deck-index.js"
import { landedPatch, type Register } from "./decide.js"
import { slideNode, type SlideId } from "./element-id.js"
import { floorOpening } from "./slide-floor.js"

export function ownFloor(register: Register, slide: SlideId): IndexElement {
  const node = slideNode(slide, "slide")
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  const opening = floorOpening(register, node, body === undefined ? {} : landedPatch(body, "text"))
  return { node, kind: "slide", value: null, box: null, grouped: false, ...(opening === undefined ? {} : { opening }) }
}
