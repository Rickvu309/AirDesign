import { expect, it } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { exportBaseName, exportFileName } from "./export-file-name"

const smile = "😀"

it("names the export after the deck", () => {
  expect(exportFileName("Q3 Board, October")).toBe("Q3 Board, October.pptx")
})

it("gives an unnamed deck the blank deck copy", () => {
  for (const name of [undefined, "", "   "]) {
    expect(exportFileName(name)).toBe(`${productCopy.blankDeck}.pptx`)
  }
})

it("replaces the characters a file name may not hold with a space", () => {
  expect(exportFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j.pptx")
  expect(exportFileName("tab\there\u0000end")).toBe("tab here end.pptx")
})

it("drops the dots and spaces a file name may not end with", () => {
  expect(exportFileName("Plan. ")).toBe("Plan.pptx")
  expect(exportFileName("...")).toBe(`${productCopy.blankDeck}.pptx`)
})

it("keeps at most 120 characters of the name, counting an emoji once", () => {
  expect(exportFileName("x".repeat(200))).toBe(`${"x".repeat(120)}.pptx`)
  expect(exportFileName(smile.repeat(200))).toBe(`${smile.repeat(120)}.pptx`)
})

it("uses one base name for PDF and PowerPoint, including fallback and sanitizing", () => {
  for (const [name, base] of [
    ["Q3 Board", "Q3 Board"],
    ["Q3 / Board: final. ", "Q3 Board final"],
    [undefined, productCopy.blankDeck],
    ["...", productCopy.blankDeck],
    [smile.repeat(200), smile.repeat(120)],
  ]) {
    expect(exportBaseName(name)).toBe(base)
    expect(exportFileName(name)).toBe(`${base}.pptx`)
  }
})
