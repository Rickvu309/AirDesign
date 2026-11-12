export { browserExportFailures, paragraphExportFailures, routeExportFailures } from "./browser-export.js"
export { branchOrderErrors } from "./child-order.js"
export { exportPackage } from "./export-package.js"
export { indexPackage } from "./index-package.js"
export { prepareMarkup } from "./element-span.js"
export type { PaintColor, PaintFill } from "./paint-color.js"
export type { PaintLine } from "./paint-shape.js"
export { paintReader, type PaintBox, type PaintElement, type PaintReader, type SlidePaint } from "./paint-reader.js"
export type { PaintParagraph, PaintRunStyle, PaintText } from "./paint-text.js"
export type { PaintTable } from "./paint-table.js"
export { readShapes, readSlides, type ReadShape } from "./read-shapes.js"
export { readParts } from "./package-container.js"
export { readPackage, type PackageLimitName } from "./package-limits.js"
export { exactPageCheck } from "./render-pages.js"
export {
  danglingShapeReferences,
  freeShapeId,
  newDanglingShapeReferences,
  newDuplicateShapeIds,
  shapeIdCounts,
} from "./shape-id.js"
export { applyRoute, oneRunValue } from "./slide-route.js"
export { routeOperations, routeRuns, touchMatches } from "./route-parts.js"
export { newValidatorErrors } from "./validator-error.js"
export { writtenRoutes } from "./written-routes.js"
export { orderedParts } from "./slide-order-route.js"
export { slideLayouts } from "./slide-layouts.js"
export { slideExportFailures } from "./slide-export.js"
export { paintKind } from "./shape-tree.js"
export { readNotes, writeNotes, type SlideNotes } from "./notes-body.js"
