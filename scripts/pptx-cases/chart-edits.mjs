import { chartEditsExportName, chartEditsLines } from "../chart-edits.mjs"

export default {
  specs: ["tests/browser/chart-export.spec.ts"],
  exports: [chartEditsExportName],
  lines: chartEditsLines,
}
