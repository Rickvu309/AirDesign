import { slideEditsExportName, slideEditsLines } from "../slide-edits.mjs"

export default {
  specs: ["tests/browser/slide-edits.spec.ts"],
  exports: [slideEditsExportName],
  lines: slideEditsLines,
}
