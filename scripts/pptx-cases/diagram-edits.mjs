import { diagramEditsExportName, diagramEditsLines } from "../diagram-edits.mjs"

export default {
  specs: ["tests/browser/diagram-export.spec.ts"],
  exports: [diagramEditsExportName],
  lines: diagramEditsLines,
}
