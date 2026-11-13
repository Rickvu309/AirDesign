import { shapeExportLines, shapeExportName } from "../shape-export.mjs"

export default {
  specs: ["tests/browser/shape-insert.spec.ts"],
  exports: [shapeExportName],
  lines: shapeExportLines,
}
