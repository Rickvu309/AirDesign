import { slideExportLines, slideExportName } from "../slide-export.mjs"

export default {
  specs: ["tests/browser/slide-export.spec.ts"],
  exports: [slideExportName],
  lines: slideExportLines,
}
