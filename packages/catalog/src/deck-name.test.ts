import { expect, it } from "vitest"
import { deckName, readRename } from "./index.js"

const smile = "\ud83d\ude00"

it("deckName makes a file name into the name readRename keeps", () => {
  const named: readonly (readonly [string, string])[] = [
    ["Board deck.PPTX", "Board deck"],
    ["Board deck.pptx.pptx", "Board deck.pptx"],
    ["  Board deck .pptx", "Board deck"],
    ["notes.txt", "notes.txt"],
    [`${"x".repeat(199)}${smile}.pptx`, `${"x".repeat(199)}${smile}`],
    [`${"x".repeat(199)}${smile}y.pptx`, `${"x".repeat(199)}${smile}`],
    [`${smile.repeat(250)}.pptx`, smile.repeat(200)],
    [`${"x".repeat(199)} y.pptx`, "x".repeat(199)],
    [`  ${"x".repeat(200)}.pptx`, "x".repeat(200)],
  ]
  for (const [file, name] of named) {
    expect(deckName(file)).toBe(name)
    expect(readRename({ deck: "d", name: deckName(file) })).toEqual({ ok: true, deck: "d", name })
  }
})

it("deckName gives no name for a file name the server would refuse", () => {
  for (const file of [".pptx", "  .pptx", "\ud83d.pptx", "a\u0000b.pptx"]) expect(deckName(file)).toBe("")
})
