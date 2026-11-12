import { boxExportLines, boxExportName } from "../paragraph-export.mjs"

export default {
  specs: ["tests/browser/box-export.spec.ts"],
  exports: [boxExportName],
  lines: boxExportLines,
}
