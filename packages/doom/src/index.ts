export {
  type AgentChange,
  type AgentColor,
  type AgentRefusal,
  agentChangesSchema,
  readAgentChange,
  readAgentChanges,
} from "./agent-change.js"
export { compileAgentChange } from "./agent-compile.js"
export { boardDeckChanges } from "./board-deck.js"
export { placeholderTitle } from "./placeholder-title.js"
export { pictureFit } from "./picture-fit.js"
export { slideKeyText } from "./slide-key.js"
export { type AddedNode, compileAgentEdit, readingOf } from "./agent-edit.js"
export type { AgentFinding } from "./agent-findings.js"
export { type LayoutFinding, layoutFindings, touchedSlides, unmeasuredTexts } from "./layout-findings.js"
export { kindOf as agentKind, readForAgent } from "./agent-read.js"
export { type Counts, type Known, applyEdit, countsOf, hasDeck, landEdit } from "./apply-edit.js"
export { foldToJson, readFold, readLanded, readRuns, readStoredNode, revsToJson, runsToJson } from "./fold-json.js"
export type { Arrow, End, Geometry } from "./geometry.js"
export { type NodeId, type Rev, nodeId, rev } from "./ids.js"
export { invert } from "./invert.js"
export { type Replaced, type RunEdit, type Undone, invertRun, readRunEdit, replacedBy } from "./invert-run.js"
export type { Align9, Cell, Layout, Sizing, Track } from "./layout.js"
export type { Chart } from "./chart.js"
export type { Color, ColorVar, Effect, EffectStyleName, Hex, ImagePaint, Paint, Sides, StrokeStyle } from "./paint.js"
export { effectStyleNames } from "./paint.js"
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
  type Write,
  emptyDoom,
} from "./doom.js"
export type { Para, Span, Text, TextStyleName } from "./text.js"
export { notesText } from "./notes-text.js"
export { type TextPatch, lookWrite, paraWrite, styleWrite } from "./text-writes.js"
export type { TextStyle, Theme } from "./theme.js"
export { viewOf } from "./view-of.js"
export { resolveColor, tinted } from "./color.js"
export { type Measure, type Measured, measureWith } from "./measure.js"
export { solveLayout } from "./solve-layout.js"
export { bakeLayout } from "./bake-layout.js"
export { deriveChart } from "./derive-chart.js"
export type { Box, Point, Resolved, ResolvedEffect, ResolvedLine, ResolvedPaint, ResolvedRun } from "./resolved.js"
export { resolveSlide, slideBackground } from "./resolve-slide.js"
export { adjustDefaults, presetHolds, presetOutline, presetSites, textArea } from "./preset-geometry.js"
export { routeDistance } from "./line-ends.js"
export { defaultTheme } from "./default-theme-art.js"
export { slideTextStyles } from "./slide-text-styles.js"
export { type Grown, type Tree, type TreeNode, type TreeSlide, doomFromTree } from "./doom-tree.js"
export { deckName, deckOf } from "./deck-of.js"
export { slidesOf } from "./doom-walk.js"
export { type ListedRun, liveRuns, runsOf } from "./live-runs.js"
export { type Face, type FaceNeeds, doomFaces } from "./text-faces.js"
export { contentAreaOf } from "./agent-place.js"
export { sampleChart } from "./sample-charts.js"
export { placeholderSubtitle, titleOnlyWrites, titleSlideWrites } from "./slide-placeholders.js"
export { type SlideStart, slideStartWrites, slideStarts } from "./slide-starts.js"
export { blankDeckName, deckNameFollows, nameFromTitleWrites } from "./deck-name-from-title.js"
export { bytesOf, limits, overLimit } from "./limits.js"
export { type FontFace, type FontWidths, type Glyph, fontFace } from "./line-breaks.js"
export { type OrderKey, orderKeyBetween } from "./order-key.js"
export { type Clipboard, type Copies, copiedMove, duplicateWrites, pasteWrites } from "./copy-writes.js"
