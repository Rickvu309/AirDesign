import { boxExportLines, boxExportName } from "../paragraph-export.mjs"

export default {
  specs: ["tests/browser/box-export.spec.ts"],
  exports: [boxExportName],
  covers: ["box.x", "box.y", "box.w", "box.h"],
  lines: boxExportLines,
}
