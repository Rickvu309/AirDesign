import { blankRangeExportName, currentSlideExportName, slideSubsetLines } from "../slide-subset.mjs"

export default {
  specs: ["tests/browser/export-dialog.spec.ts"],
  exports: [currentSlideExportName, blankRangeExportName],
  lines: slideSubsetLines,
}
