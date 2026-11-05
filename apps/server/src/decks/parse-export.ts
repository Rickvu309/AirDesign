import type { ExportOptions } from "./export-store.ts"

export function parseExportOptions(value:unknown):ExportOptions {
  if(!value || typeof value!=="object" || !("format" in value) || !("slides" in value) || !("timing" in value) || !("expectedSeq" in value) || !("allowIssues" in value))throw new Error("export-options-required")
  const {format,slides,timing,expectedSeq,allowIssues}=value
  if((format!=="pptx" && format!=="pdf")||(timing!=="now" && timing!=="after-run")||!Array.isArray(slides)||!slides.every((id:unknown):id is string=>typeof id==="string")||typeof expectedSeq!=="number"||typeof allowIssues!=="boolean")throw new Error("invalid-export-options")
  return {format,slides,timing,expectedSeq,allowIssues}
}
