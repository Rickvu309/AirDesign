import { paragraphExportLines, paragraphsExportName } from "../paragraph-export.mjs"

export default {
  specs: ["tests/browser/thin-deck.spec.ts"],
  exports: [paragraphsExportName],
  lines: paragraphExportLines,
}
