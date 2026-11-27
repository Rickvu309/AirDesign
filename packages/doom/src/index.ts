export {
  type AgentChange,
  type AgentColor,
  type AgentRefusal,
  agentChangesSchema,
  readAgentChange,
  readAgentChanges,
} from "./agent-change.js"
export { wrapDegrees, wrapRotation } from "./angle.js"
export {
  type Matrix,
  apply as applyMatrix,
  artMatrix,
  boxMatrix,
  contentMatrix,
  fitShift,
  identity as identityMatrix,
  invert as invertMatrix,
  unfittedBox,
} from "./matrix.js"
export { compileAgentChange } from "./agent-compile.js"
export { boardDeckChanges } from "./board-deck.js"
export { placeholderTitle } from "./placeholder-title.js"
export { pictureFit } from "./picture-fit.js"
export { coverCrop, type ImageCrop } from "./picture-crop.js"
export { slideKeyText } from "./slide-key.js"
export {
  type AgentEdit,
  type AgentSession,
  type Bake,
  agentEditSession,
  compileAgentEdit,
  readingOf,
} from "./agent-edit.js"
export type { AgentFinding } from "./agent-findings.js"
export {
  type LayoutFinding,
  type MissingGlyphs,
  layoutFindings,
  missingGlyphsIn,
  touchedSlides,
  unmeasuredTexts,
} from "./layout-findings.js"
export { kindOf as agentKind, readForAgent } from "./agent-read.js"
export { type Counts, applyEdit, countsOf, hasDeck, landEdit } from "./apply-edit.js"
export { foldToJson, readFold, readLanded, readRuns, readStoredNode, revsToJson, runsToJson } from "./fold-json.js"
export { type Arrow, type End, type Geometry, lineArrowheads } from "./geometry.js"
export { type NodeId, type Rev, nodeId, readNodeId, rev } from "./ids.js"
export { changingWrites, sameValue } from "./changing-writes.js"
export { invert } from "./invert.js"
export { onStandingLayers } from "./standing-layers.js"
export { type Replaced, type RunEdit, type Undone, invertRun, readRunEdit, replacedBy } from "./invert-run.js"
export type { Align9, Cell, Layout, Sizing, Track } from "./layout.js"
export type { Color, ColorVar, Effect, Hex, ImagePaint, Paint, StrokeStyle } from "./paint.js"
export { colorVars, paletteColorVars } from "./paint.js"
export { type NodeType, type Origin, type PropName, type Props, type WriteKey, accepts, holds, props } from "./props.js"
export { textFromMarkdown, textToMarkdown } from "./markdown.js"
export { readEdit, readWrite } from "./read-write.js"
export { type Refusal, isRefusal } from "./refusal.js"
export {
  type Author,
  type Edit,
  type Landed,
  type Node,
  type Run,
  type RunUndo,
  type Doom,
  type RevisionKey,
  type Write,
  emptyDoom,
} from "./doom.js"
export type { Para, Span, Text, TextStyleName } from "./text.js"
export { paragraphAligns, textLimits, textStyleNames } from "./text.js"
export { notesText } from "./notes-text.js"
export { type TextPatch, lookWrite, paraWrite, styleWrite } from "./text-writes.js"
export type { Theme } from "./theme.js"
export { onTop, viewOf } from "./view-of.js"
export { readColor, resolveColor, sameColor, tinted } from "./color.js"
export {
  type Measure,
  type Measured,
  type MeasureLayout,
  type MeasureProbe,
  charsByFace,
  measureWith,
  measureWithLayout,
} from "./measure.js"
export { solveLayout } from "./solve-layout.js"
export { fontSamples, graphemes } from "./graphemes.js"
export { bakeLayout, bakeTextLayers } from "./bake-layout.js"
export type { Box, Point, Resolved, ResolvedEffect, ResolvedLine, ResolvedPaint, ResolvedRun } from "./resolved.js"
export { resolveSlide, slideBackground } from "./resolve-slide.js"
export {
  type Site,
  adjustDefaults,
  presetHolds,
  presetOutline,
  shapeNames,
  siteSpot,
  textArea,
} from "./preset-geometry.js"
export { readLinkAddress } from "./link.js"
export { routeDistance } from "./line-ends.js"
export { freedEnds, freeLineEnds, lostBy, mayLeaveDeck } from "./freed-line-ends.js"
export { leavingRoots, returningRoots } from "./lost-ends.js"
export { lineEndsBack } from "./line-ends-back.js"
export { holdsLineEnd } from "./line-end-holder.js"
export { libraryThemeOf } from "./library-theme-of.js"
export { defaultTheme, themeLibrary } from "./theme.js"
export { type Grown, type Tree, type TreeNode, type TreeSlide, doomFromTree } from "./doom-tree.js"
export { deckName, deckOf } from "./deck-of.js"
export {
  childrenOf,
  descendantsOf,
  flows,
  holdsText,
  lockedIn,
  onDeck,
  parentOf,
  propOf,
  slideOf,
  slideRowAt,
  slidesOf,
} from "./doom-walk.js"
export { liveRuns, runsOf } from "./live-runs.js"
export { type Face, type FaceNeeds, doomFaces } from "./text-faces.js"
export { contentAreaOf, gapFor } from "./agent-place.js"
export { placeholderSubtitle, titleOnlyWrites, titleSlideWrites } from "./slide-placeholders.js"
export { type SlideStart, slideStartWrites, slideStarts } from "./slide-starts.js"
export { blankDeckName, deckNameFollows, nameFromTitleWrites } from "./deck-name-from-title.js"
export { bytesOf, limits } from "./limits.js"
export { type MediaType, mediaSize, mediaTypeOf, mediaTypes, overPixelLimit } from "./media-bytes.js"
export { type FontFace, type FontWidths, type Glyph, fontFace } from "./line-breaks.js"
export { familyOf, paintedFace, storedFace } from "./painted-face.js"
export { type OrderKey, orderKeyBetween } from "./order-key.js"
export { type Keyed, siblingKeys } from "./sibling-keys.js"
export { type SlideGroup, slideGroups, slidePlacementWrites } from "./slide-placement.js"
export { type Clipboard, type Copies, copiedMove, duplicateWrites, pasteWrites } from "./copy-writes.js"
export { moveToSlide } from "./move-to-slide.js"
export type { LayerPositions } from "./standing-layers.js"

export { deckTexts } from "./deck-of.js"
