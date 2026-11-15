export {
  elementId,
  elementPattern,
  legacyElement,
  readElementId,
  readSlideId,
  rootElement,
  shapeOf,
  slideId,
  slideNode,
  slideKind,
  slideKinds,
  storedElements,
  type ElementId,
  type SlideId,
} from "./element-id.js"
export { orderKeyBetween, type OrderKey } from "./order-key.js"
export {
  answeredRegister,
  appendIndex,
  indexDue,
  indexKeys,
  readIndexPage,
  type DeckIndex,
  type IndexElement,
  type IndexPage,
  type IndexSlide,
  type SlideSize,
} from "./deck-index.js"
export {
  designBytes,
  designKeys,
  readDesign,
  roles,
  sources,
  type Design,
  type DesignKey,
  type ElementRead,
  type FillRead,
  type GlowRead,
  type RecolorRead,
  type CropRead,
  type Palette,
  type Read,
  type Role,
  type ShadowRead,
  type Shown,
  type Source,
  type TraitReads,
} from "./design.js"
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
  landedPatch,
  openRegister,
  refusals,
  shownPatch,
  valueHolder,
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
export { storedValue, valueBytes, type FormatOneValue, type Value } from "./value.js"
export {
  namedFields,
  planChange,
  registerScope,
  writtenField,
  type AddChange,
  type Scope,
  type ScopedElement,
  type SetChange,
  type Target,
} from "./change.js"
export {
  beforeOf,
  boxPatch,
  formatOne,
  netPatch,
  readRow,
  rowOf,
  shows,
  type ElementPatch,
  type FieldEdit,
  type Row,
  type TraitPatch,
} from "./row.js"
export { agentTakes, boxOnly, indexFacts, opacityFields, removable, takes } from "./element-takes.js"
export {
  alphaKeys,
  type AlphaField,
  inheritable,
  keptRefuses,
  kindTraits,
  traitNames,
  traits,
  type FieldKey,
  type HasAlpha,
  type InheritableField,
  type FieldName,
  type FieldValue,
  type TraitName,
  type WireAgent,
  type WireField,
} from "./traits.js"
export type { Alpha, Desc, Fields, NumberUnit } from "./value-kind.js"
export { kinds, type Kind } from "./kinds.js"
export { structure } from "./structure.js"
export { foldSections, type FileSection } from "./section-order.js"
export { floorFor, floorNodes, floorOpening, newSlideElement, openingElement } from "./slide-floor.js"
export { widestEffect } from "./trait-effects.js"
export { patternPresets } from "./trait-fill.js"
export { recolors } from "./trait-image.js"
export { altBytes, nameBytes } from "./trait-identity.js"
export { assetIcon, iconNamePattern, readAsset } from "./asset-ref.js"
export { arrowheads, arrowSizes, dashPresets, lineCaps, lineCompounds, lineJoins, widestLine } from "./trait-line.js"
export { anchors, autofits, mostColumns, verticals } from "./trait-body.js"
export { adjustLimit, presetAdjusts, presets, type Preset } from "./trait-geometry.js"
export { alignments } from "./trait-box.js"
export { slideMeasure } from "./slide-measure.js"
export {
  addedPictures,
  elementCommand,
  elementGone,
  mediaTypes,
  nextElementId,
  openingIcon,
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
export { format, formatOf, newerFormat, stamps } from "./format.js"
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
  alphaOf,
  bareTransforms,
  fadedColor,
  mappedSlots,
  namesAlpha,
  opaque,
  readColor,
  sameColor,
  themeSlots,
  valuedTransforms,
  type Color,
  type ColorBase,
  type ColorTransform,
  type MappedSlot,
  type ThemeSlot,
} from "./color.js"
export {
  readTextValue,
  alignNames,
  formatNames,
  schemeNames,
  spacingNames,
  writeTextValue,
  type ParagraphAlign,
  type ParagraphSpacing,
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
export { ownFloor, upgradeBackgrounds } from "./background-upgrade.js"
export { redoOf, slideUndoable, undoOf, undoSlides, type NodeStep, type Undoable } from "./person-undo.js"
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
