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
  templateStylesNode,
  templateStyleNode,
  templateStyleIndex,
  templateStyleOwned,
  type ElementId,
  type SlideId,
} from "./element-id.js"
export { orderKeyBetween, type OrderKey } from "./order-key.js"
export { answeredRegister } from "./answered-register.js"
export {
  appendIndex,
  indexDue,
  indexedSectionStarts,
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
  designWordBytes,
  designKeys,
  designOrder,
  shadowSlotKeys,
  readDesign,
  roles,
  sources,
  templateFonts,
  type Design,
  type DesignKey,
  type ElementRead,
  type FillRead,
  type GlowRead,
  type RecolorRead,
  type CropRead,
  type BoundRead,
  type Palette,
  type Read,
  type Role,
  type ShadowRead,
  type Shown,
  type Source,
  type TemplateFont,
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
  type Refusal,
} from "./decide.js"
export { coordinates, readBox, type Box } from "./box.js"
export { fitNewBox, placeNewBox } from "./box-placement.js"
export { storedValue, valueBytes, type FormatOneValue, type Value } from "./value.js"
export {
  namedFields,
  paintsBackdrop,
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
  rowOf,
  shows,
  type ElementPatch,
  type FieldEdit,
  type Row,
  type TraitPatch,
} from "./row.js"
export { boxOnly, indexFacts, opacityFields, removable, takes } from "./element-takes.js"
export {
  alphaKeys,
  type AlphaField,
  inheritable,
  keptRefuses,
  kindTraits,
  slotted,
  traitNames,
  traits,
  type FieldKey,
  type HasAlpha,
  type InheritableField,
  type InputName,
  type SlotField,
  type FieldName,
  type FieldValue,
  type TraitName,
  type TraitValue,
  type WireAgent,
  type WireField,
} from "./traits.js"
export type { Alpha, Desc, Fields, NumberUnit } from "./value-kind.js"
export { kinds, type Kind } from "./kinds.js"
export { structure } from "./structure.js"
export { type FileSection } from "./section-order.js"
export { slideGroups } from "./slide-groups.js"
export { floorFor, floorNodes, floorOpening, newSlideElement, openingElement } from "./slide-floor.js"
export { type TransitionValue } from "./trait-transition.js"
export { widestEffect } from "./trait-effects.js"
export {
  changeEffects,
  readEffects,
  type Effect,
  type EffectKey,
  type EffectsSource,
  type Entry,
  type KeptEffect,
  type ResolvedEffects,
  type ShadowPreset,
} from "./effects-list.js"
export { readTextFill, type TextFill } from "./text-fill.js"
export {
  changeFills,
  paintSlots,
  patternPresets,
  readFills,
  type Overlay,
  type Paint,
  type ShownFills,
  type SlotPaint,
} from "./trait-fills.js"
export { listedPaints, listedSlots, type FillsListEdit } from "./fills-list.js"
export { nameBytes } from "./trait-identity.js"
export { assetIcon, assetMedia, iconNamePattern, mediaTypes, type Media, type MediaType } from "./asset-ref.js"
export {
  arrowheads,
  arrowSizes,
  borderCaps,
  borderCompounds,
  borderJoins,
  dashPresets,
  widestBorder,
} from "./trait-border.js"
export { anchors, autofits, mostColumns, verticals } from "./trait-body.js"
export { adjustLimit, presetAdjusts, presets, type Preset } from "./trait-geometry.js"
export {
  connectorEnds,
  elbowClearance,
  outlineOf,
  route,
  routed,
  siteKinds,
  sitePoint,
  siteTie,
  type Bound,
  type Outline,
  type Tie,
} from "./connector.js"
export { siteCount, siteSpot, type Spot } from "./preset-sites.js"
export { presetGuides } from "./preset-guides.js"
export { alignments } from "./trait-box.js"
export { slideMeasure } from "./slide-measure.js"
export {
  addedPictures,
  elementCommand,
  elementGone,
  nextElementId,
  openingIcon,
  type ElementCommand,
  type Geometry,
  lineGeometries,
} from "./element-order.js"
export { elementStacks, stackTarget, type ElementStack, type StackMove } from "./element-stack.js"
export {
  groupCommand,
  groupedNow,
  groupFormed,
  groupFrame,
  groupParent,
  groupNode,
  madeGroup,
  plainGroup,
  type Member,
} from "./element-group.js"
export { groupOf, placeOf, throughGroup, ungroupRows, type Place, type PlacedRow } from "./group-place.js"
export { changeLayout, layoutNodes, readLayout, type LayoutView } from "./frame-layout.js"
export { fittedBox } from "./group-space.js"
export { spotNow } from "./group-join.js"
export { layoutFromFile, layoutMarker } from "./frame-marker.js"
export { measureDue, measureOwed, measureStale } from "./frame-measure.js"
export { regroupTurn, ungroupTurn } from "./group-turn.js"
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
export { format, formatOf, newerFormat, stamps, type StoredRead } from "./format.js"
export { readRegister, readRow, readStoredEdit, type StoredEdit } from "./stored.js"
export {
  cellText,
  changedTable,
  openingTable,
  readTableValue,
  tableColumns,
  writeTableValue,
  type TableChange,
  type TableRow,
  type TableValue,
} from "./table-value.js"
export { tableSides, type Border, type Borders, type CellFill, type TableSide } from "./table-cells.js"
export {
  alphaOf,
  bareTransforms,
  fadedColor,
  mappedSlots,
  namesAlpha,
  opaque,
  readColor,
  sameColor,
  templateColors,
  valuedTransforms,
  type Color,
  type ColorTransform,
  type MappedSlot,
  type TemplateColor,
} from "./color.js"
export { cycledColor, presentSlots } from "./template-remix.js"
export {
  readTextValue,
  hasSlideNumber,
  openingSlideNumber,
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
  type TextList,
  type TextRun,
  type TextValue,
} from "./text-value.js"
export { withCurrentKeys } from "./current-keys.js"
export {
  linkRange,
  linkState,
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
  sizeRange,
  sizeState,
  stepSize,
  typedSize,
  type Caret,
  type SizeStep,
  type FormatState,
  type TextRange,
} from "./text-format.js"
export { slidesKept } from "./slide-kept.js"
export { ownFloor } from "./own-floor.js"
export {
  elementsUndoable,
  redoOf,
  slideUndoable,
  undoOf,
  undoSlides,
  type NodeStep,
  type Undoable,
} from "./person-undo.js"
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
export { contrast, readableText } from "./contrast.js"
export { colorPaint, gamma, hexRgb, hslRgb, paintSteps, presetColors, rgbHex, type Rgb } from "./color-paint.js"
export { slideFindings, type SlideFindings } from "./slide-findings.js"

export {
  defaultGrid1,
  gridCommandVersion,
  gridSectionStarts,
  gridGroups,
  foldGrid,
  type GridSide,
} from "./grid-order.js"
export { gridMovePlacement } from "./grid-move.js"
export { readElementLink, readLinkTarget, type ElementLink, type LinkTarget, type LinkEdit } from "./link-target.js"

export { slideBirths } from "./slide-births.js"
export { cloneMany } from "./grid-set.js"
export { type TemplateStyle } from "./template-style.js"
export { readTextStyles, textStylesOf, type TextStyle, type TextStyleFields } from "./text-style.js"
export {
  plainSlideNumber,
  shownSlideNumber,
  numberCounts,
  numberFormats,
  type SlideNumber,
  type SlideNumbers,
} from "./slide-number.js"
