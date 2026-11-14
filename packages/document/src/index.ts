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
  type SlideSize,
} from "./deck-index.js"
export { replay, unsent, type Queued } from "./replay.js"
export { bytesOf, limits, overLimit } from "./limits.js"
export {
  compactChain,
  currentBox,
  currentValue,
  decide,
  decideUndo,
  editMissing,
  foldRegister,
  history,
  openRegister,
  refusals,
  version,
  type Command,
  type Decision,
  type Landed,
  type Missing,
  type NodeRegister,
  type Phase,
  type Register,
  type RootRegister,
  type StoredRegister,
  type Refusal,
} from "./decide.js"
export { coordinates, readBox, type Box } from "./box.js"
export { placeNewBox } from "./box-placement.js"
export { storedValue, valueBytes, type Value } from "./value.js"
export { elementTakes, indexFacts, type ElementEdit } from "./element-takes.js"
export { kinds, properties, type ExportRoute, type Kind } from "./properties.js"
export { structure, type StructuralRoute } from "./structure.js"
export { foldSections, type FileSection } from "./section-order.js"
export { floorFor, floorNodes, openingElement } from "./slide-floor.js"
export { slideMeasure } from "./slide-measure.js"
export {
  addedPictures,
  elementCommand,
  elementGone,
  mediaTypes,
  nextElementId,
  type ElementCommand,
  type Geometry,
  type Media,
  type MediaType,
} from "./element-order.js"
export { elementStacks, stackTarget, type ElementStack, type StackMove } from "./element-stack.js"
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
export {
  cellText,
  changedTable,
  openingTable,
  readTableValue,
  tableColumns,
  writeTableValue,
  type TableChange,
  type TableValue,
} from "./table-value.js"
export {
  readTextValue,
  alignNames,
  formatNames,
  schemeNames,
  writeTextValue,
  type ParagraphAlign,
  type RunColor,
  type RunFormat,
  type SchemeName,
  type TextFormat,
  type TextParagraph,
  type TextRun,
  type TextValue,
} from "./text-value.js"
export {
  alignRange,
  alignState,
  bulletRange,
  bulletState,
  colorRange,
  colorState,
  formatRange,
  formatState,
  formatWhole,
  sameFormats,
  sizeState,
  stepSize,
  type Caret,
  type FormatState,
  type TextRange,
} from "./text-format.js"
export { slidesKept } from "./slide-kept.js"
export { backgroundOf } from "./slide-background.js"
export { redoOf, slideUndoable, undoOf, undoSlides, type Undoable } from "./person-undo.js"
export type {
  Fill,
  ResolvedElement,
  ResolvedParagraph,
  ResolvedRun,
  ResolvedSlide,
  ResolvedText,
  Spacing,
} from "./resolved-slide.js"
export { fontFace, layText, type FontWidths } from "./text-fit.js"
export { findingLimits, type Finding } from "./finding.js"
export { slideFindings, type SlideFindings } from "./slide-findings.js"
