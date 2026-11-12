import type { PackageLimitName } from "@airdesign/pptx"

export type ImportFailureReason = PackageLimitName | "encrypted" | "not-pptx" | "xml" | "zip" | "save"

export type ImportFailureWords = { readonly detail: string }

const designedFailure: ImportFailureWords = { detail: "Unable to import" }

export const importFailureWordsByReason: Record<ImportFailureReason, ImportFailureWords> = {
  encrypted: designedFailure,
  "not-pptx": designedFailure,
  xml: designedFailure,
  zip: designedFailure,
  save: designedFailure,
  packedBytes: designedFailure,
  slides: designedFailure,
  unpackedBytes: designedFailure,
  parts: designedFailure,
  xmlBytes: designedFailure,
  binaryBytes: designedFailure,
  depth: designedFailure,
  attributes: designedFailure,
  nodes: designedFailure,
  ratio: designedFailure,
}

export function importFailureWords(reason: ImportFailureReason): ImportFailureWords {
  return importFailureWordsByReason[reason]
}
