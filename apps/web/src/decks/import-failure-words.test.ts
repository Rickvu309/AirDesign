import { describe, expect, it } from "vitest"
import { importFailureWords, importFailureWordsByReason, type ImportFailureReason } from "./import-failure-words"

async function designedScreen(): Promise<string> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL, encoding: "utf8") => Promise<string> }
  return fs.readFile(new URL("./screens/import-failed.tsx", import.meta.url), "utf8")
}

const reasons = Object.keys(importFailureWordsByReason) as ImportFailureReason[]

describe("importFailureWords", () => {
  it("names every refusal the reader and the save can give", () => {
    expect(reasons).toEqual(
      expect.arrayContaining(["encrypted", "not-pptx", "xml", "zip", "save", "slides", "packedBytes", "ratio"]),
    )
    expect(reasons).toHaveLength(15)
  })

  it.each(reasons)("gives %s only words the designed import failure already shows", async (reason) => {
    expect(await designedScreen()).toContain(importFailureWords(reason).detail)
  })

  it.fails("gives an encrypted file words of its own, apart from a file that is not a PowerPoint", () => {
    expect(importFailureWords("encrypted")).not.toEqual(importFailureWords("not-pptx"))
  })
})
