export {
  elementId,
  elementPattern,
  legacyElement,
  readElementId,
  readSlideId,
  rootElement,
  shapeOf,
  slideId,
  storedElements,
  type ElementId,
  type SlideId,
} from "./element-id.js"
export { orderKeyBetween, type OrderKey } from "./order-key.js"
export {
  appendIndex,
  readIndexPage,
  type DeckIndex,
  type IndexElement,
  type IndexPage,
  type IndexSlide,
} from "./deck-index.js"
export { replay, unsent, type Queued } from "./replay.js"
export { bytesOf, limits, overLimit } from "./limits.js"
export {
  compactChain,
  currentBox,
  currentValue,
  decide,
  decideUndo,
  foldRegister,
  history,
  openRegister,
  refusals,
  version,
  type Command,
  type Decision,
  type Landed,
  type NodeRegister,
  type Phase,
  type Register,
  type RootRegister,
  type StoredRegister,
  type Refusal,
} from "./decide.js"
export { coordinates, readBox, type Box } from "./box.js"
export { storedValue, valueBytes, type Value } from "./value.js"
export { kinds, properties, type ExportRoute, type Kind } from "./properties.js"
export { structure, type StructuralRoute } from "./structure.js"
export { floorFor, floorNodes, openingElement } from "./slide-floor.js"
export {
  foldSlides,
  nextSlideId,
  orderKeyAfter,
  presentSlides,
  readSlideState,
  slideGone,
  type SlideCommand,
  type SlideState,
} from "./slide-order.js"
export { readTextValue, writeTextValue, type TextParagraph, type TextRun, type TextValue } from "./text-value.js"
export { redoOf, slideUndoable, undoOf, type Undoable } from "./person-undo.js"
