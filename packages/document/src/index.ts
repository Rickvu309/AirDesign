export { elementId, readElementId, readSlideId, shapeOf, slideId, type ElementId, type SlideId } from "./element-id.js"
export {
  appendIndex,
  indexDue,
  indexKeys,
  readIndexPage,
  type DeckIndex,
  type IndexElement,
  type IndexPage,
  type SlideSize,
} from "./deck-index.js"
export {
  designKeys,
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
  type Palette,
  type Read,
  type Role,
  type ShadowRead,
  type Shown,
  type Source,
  type TemplateFont,
  type TraitReads,
} from "./design.js"
export { refusals, type Refusal } from "./refusals.js"
export { coordinates, readBox, type Box } from "./box.js"
export { type SetChange, type Target } from "./set-change.js"
export { type FieldEdit, type TraitPatch } from "./trait-patch.js"
export {
  alphaKeys,
  traitNames,
  traits,
  type HasAlpha,
  type SlotField,
  type FieldName,
  type FieldValue,
  type TraitName,
  type TraitValue,
  type WireField,
} from "./traits.js"
export type { Alpha, Desc, Fields, NumberUnit } from "./value-kind.js"
export { kinds, type Kind } from "./kinds.js"
export { type FileSection } from "./section-order.js"
export { slideGroups } from "./slide-groups.js"
export { type TransitionValue } from "./trait-transition.js"
export { readGuideList, readLayoutGuides, type Guide, type LayoutGuide } from "./trait-guides.js"
export { widestEffect } from "./trait-effects.js"
export { readTextFill, type TextFill } from "./text-fill.js"
export { iconWeights, paintSlots, patternPresets, type Overlay, type Paint } from "./trait-fills.js"
export { nameBytes } from "./trait-identity.js"
export { assetIcon, assetMedia, mediaTypes, type Media, type MediaType } from "./asset-ref.js"

export { mediaSize, mediaTypeOf, overPixelLimit } from "./media-bytes.js"
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
export { outlineOf, route, routed, siteTie, type Outline, type Tie } from "./connector.js"
export { type Spot } from "./preset-sites.js"
export { alignments } from "./trait-box.js"
export { pastedMedia, type PastedLayers } from "./pasted-layers.js"
export {
  elementCommand,
  openingIcon,
  type ElementClone,
  type ElementCommand,
  type Geometry,
  lineGeometries,
} from "./element-order.js"
export { elementStacks, type ElementStack } from "./element-stack.js"
export { groupCommand, groupNode, madeGroup, plainGroup, type Member } from "./element-group.js"
export { openingPlace, throughGroup, type Place } from "./group-place.js"
export { fittedPlace } from "./group-space.js"
export { layoutFromFile } from "./frame-marker.js"
export {
  foldSlides,
  nextSlideId,
  orderKeyAfter,
  presentSlides,
  type SlideCommand,
  type SlideState,
} from "./slide-order.js"
export { format, formatOf } from "./format.js"
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
export {
  readTextValue,
  hasSlideNumber,
  alignNames,
  caseNames,
  formatNames,
  lineHeightPointsFloor,
  schemeNames,
  spaceCeiling,
  spacingNames,
  writeTextValue,
  type ParagraphAlign,
  type TextCase,
  type SchemeName,
  type TextFormat,
  type TextParagraph,
  type TextList,
  type TextRun,
  type TextValue,
  plainText,
} from "./text-value.js"

export { levelNumbering, listIndent, type ListIndent } from "./list-level.js"
export { formatRange, type SizeStep, type FormatState } from "./text-format.js"
export type { Fill, ResolvedRun, ResolvedSlide } from "./resolved-slide.js"
export { colorPaint, gamma, hexRgb, hslRgb, paintSteps, presetColors, rgbHex, type Rgb } from "./color-paint.js"

export { defaultGrid1, gridSectionStarts, foldGrid, type GridSide } from "./grid-order.js"
export { gridMovePlacement } from "./grid-move.js"
export { readLinkTarget, type ElementLink, type LinkEdit } from "./link-target.js"

export { slideBirths } from "./slide-births.js"

export { type TemplateStyle } from "./template-style.js"
export { readTextStyles, type TextStyle, type TextStyleFields } from "./text-style.js"
export { plainSlideNumber, shownSlideNumber, type SlideNumber, type SlideNumbers } from "./slide-number.js"
export { contrast } from "./contrast.js"
