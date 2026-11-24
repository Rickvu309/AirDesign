export { elementId, readElementId, readSlideId, shapeOf, slideId, type ElementId, type SlideId } from "./element-id.js"
export { type DeckIndex, type IndexElement, type SlideSize } from "./deck-index.js"
export {
  roles,
  sources,
  templateFonts,
  type Design,
  type Palette,
  type Read,
  type Role,
  type Shown,
  type Source,
} from "./design.js"
export { type Box } from "./box.js"
export { type FieldEdit, type TraitPatch } from "./trait-patch.js"
export type { FieldName, FieldValue, TraitName, TraitValue } from "./traits.js"
export type { Alpha } from "./value-kind.js"
export { kinds, type Kind } from "./kinds.js"
export { type FileSection } from "./section-order.js"
export { slideGroups } from "./slide-groups.js"
export { type TransitionValue } from "./trait-transition.js"
export { readGuideList, readLayoutGuides, type Guide, type LayoutGuide } from "./trait-guides.js"
export { widestEffect } from "./trait-effects.js"
export { readTextFill, type TextFill } from "./text-fill.js"
export { iconWeights, paintSlots, patternPresets } from "./trait-fills.js"
export { nameBytes } from "./trait-identity.js"
export { assetIcon, assetMedia, type Media } from "./asset-ref.js"

export {
  arrowheads,
  arrowSizes,
  borderCaps,
  borderCompounds,
  borderJoins,
  dashPresets,
  widestBorder,
} from "./trait-border.js"
export { anchors, mostColumns, verticals } from "./trait-body.js"
export { adjustLimit, presetAdjusts, presets } from "./trait-geometry.js"
export { route, routed, type Outline, type Tie } from "./connector.js"
export { type Spot } from "./preset-sites.js"
export { alignments } from "./trait-box.js"
export { type PastedLayers } from "./pasted-layers.js"
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
export { layoutFromFile } from "./frame-marker.js"
export {
  foldSlides,
  nextSlideId,
  orderKeyAfter,
  presentSlides,
  type SlideCommand,
  type SlideState,
} from "./slide-order.js"
export {
  alphaOf,
  fadedColor,
  mappedSlots,
  namesAlpha,
  opaque,
  readColor,
  sameColor,
  templateColors,
  type Color,
  type ColorTransform,
  type MappedSlot,
  type TemplateColor,
} from "./color.js"
export {
  readTextValue,
  hasSlideNumber,
  caseNames,
  formatNames,
  schemeNames,
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
} from "./text-value.js"

export { levelNumbering, listIndent, type ListIndent } from "./list-level.js"
export { formatRange } from "./text-format.js"
export type { Fill, ResolvedRun, ResolvedSlide } from "./resolved-slide.js"
export { colorPaint, gamma, hexRgb, hslRgb, paintSteps, presetColors, rgbHex, type Rgb } from "./color-paint.js"

export { gridSectionStarts, foldGrid } from "./grid-order.js"
export { readLinkTarget, type ElementLink, type LinkEdit } from "./link-target.js"

export { slideBirths } from "./slide-births.js"

export { type TemplateStyle } from "./template-style.js"
export { readTextStyles, type TextStyle, type TextStyleFields } from "./text-style.js"
export { plainSlideNumber, shownSlideNumber, type SlideNumber, type SlideNumbers } from "./slide-number.js"
