import { limits } from "@airdesign/document"
import type { PackageLimitName } from "@airdesign/pptx"

export type ImportFailureReason = PackageLimitName | "encrypted" | "not-pptx" | "xml" | "zip" | "save"

export type ImportFailureWords = { readonly title: string; readonly detail: string }

const megabytes = new Intl.NumberFormat("en", { style: "unit", unit: "megabyte", maximumFractionDigits: 0 })
const plain = new Intl.NumberFormat("en")
const plural = new Intl.PluralRules("en")

function slidesOf(count: number): string {
  return plural.select(count) === "one" ? `${plain.format(count)} slide` : `${plain.format(count)} slides`
}

const fileSize = megabytes.format(limits.bytes / 1_000_000)

const overLimit: ImportFailureWords = {
  title: "This file is too large or complex to import",
  detail:
    "It goes past a limit on what AirDesign can open. Compress its pictures in PowerPoint or split the deck, then try again.",
}

export const importFailureWordsByReason: Record<ImportFailureReason, ImportFailureWords> = {
  encrypted: {
    title: "This file has a password",
    detail: "Remove the password, save the file, and import it again.",
  },
  "not-pptx": {
    title: "This file isn't a PowerPoint deck",
    detail: "Choose a PowerPoint file that ends in .pptx.",
  },
  zip: {
    title: "Unable to open this file",
    detail: "Open it in PowerPoint and save it as a .pptx file without a password, then import that copy.",
  },
  xml: {
    title: "This file is damaged",
    detail: "Open it in PowerPoint, save a new copy, and import that copy.",
  },
  save: {
    title: "Unable to save this deck",
    detail: "Your file is unchanged. Check your connection, then choose the file again.",
  },
  packedBytes: {
    title: `This file is ${fileSize} or larger`,
    detail: `Compress its pictures in PowerPoint or split the deck so each file is under ${fileSize}, then try again.`,
  },
  slides: {
    title: `This deck has more than ${slidesOf(limits.slides)}`,
    detail: `Split it into decks of ${slidesOf(limits.slides)} or fewer, then import each one.`,
  },
  unpackedBytes: overLimit,
  parts: overLimit,
  xmlBytes: overLimit,
  binaryBytes: overLimit,
  depth: overLimit,
  attributes: overLimit,
  nodes: overLimit,
  ratio: overLimit,
}

export function importFailureWords(reason: ImportFailureReason): ImportFailureWords {
  return importFailureWordsByReason[reason]
}
