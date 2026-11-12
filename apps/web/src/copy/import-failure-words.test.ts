import { limits } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { importFailureWords, importFailureWordsByReason, type ImportFailureReason } from "./import-failure-words"

const reasons = Object.keys(importFailureWordsByReason) as ImportFailureReason[]
const inside: readonly ImportFailureReason[] = [
  "unpackedBytes",
  "parts",
  "xmlBytes",
  "binaryBytes",
  "depth",
  "attributes",
  "nodes",
  "ratio",
]

describe("importFailureWords", () => {
  it("names every refusal the reader and the save can give", () => {
    expect(reasons).toEqual(
      expect.arrayContaining(["encrypted", "not-pptx", "xml", "zip", "save", "slides", "packedBytes", ...inside]),
    )
    expect(reasons).toHaveLength(15)
  })

  it.each(reasons)("gives %s a title and a next step, never an internal name", (reason) => {
    const words = importFailureWords(reason)
    expect(words.title).not.toBe("")
    expect(words.detail).toMatch(/\.$/)
    expect(`${words.title} ${words.detail}`).not.toMatch(/Bytes|not-pptx|ratio|nodes|depth/)
  })

  it("gives an encrypted file words of its own, apart from a file that is not a PowerPoint", () => {
    expect(importFailureWords("encrypted")).not.toEqual(importFailureWords("not-pptx"))
    expect(importFailureWords("encrypted").detail).toContain("password")
  })

  it("gives each reason a person can act on its own words", () => {
    const actable: readonly ImportFailureReason[] = [
      "encrypted",
      "not-pptx",
      "xml",
      "zip",
      "save",
      "slides",
      "packedBytes",
    ]
    expect(new Set(actable.map((reason) => importFailureWords(reason).title)).size).toBe(actable.length)
  })

  it("groups the limits inside a file under one sentence", () => {
    expect(new Set(inside.map((reason) => importFailureWords(reason)))).toHaveLength(1)
  })

  it("takes the slide and size numbers from the deck limits", () => {
    expect(importFailureWords("slides").title).toContain(String(limits.slides))
    expect(importFailureWords("slides").detail).toContain(String(limits.slides))
    expect(importFailureWords("packedBytes").title).toContain(`${String(limits.bytes / 1_000_000)} MB`)
  })
})
