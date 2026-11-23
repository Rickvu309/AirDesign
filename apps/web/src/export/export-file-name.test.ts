import { expect, it } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { exportBaseName } from "./export-file-name"

const smile = "😀"

it("names the file after the deck, without characters a file name cannot hold", () => {
  for (const [name, base] of [
    ["Q3 Board", "Q3 Board"],
    ["Q3 / Board: final. ", "Q3 Board final"],
    ["", productCopy.blankDeck],
    ["...", productCopy.blankDeck],
    [smile.repeat(200), smile.repeat(120)],
  ] as const) {
    expect(exportBaseName(name)).toBe(base)
  }
})
