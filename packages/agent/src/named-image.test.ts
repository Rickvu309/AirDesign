import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { imageName, imageProblem, withAsset, type NamedImages } from "./named-image.js"

const logo = "https://images.example.com/logo.png"
const asset = "b".repeat(64)
const slide = "s:1"

const pictures = [
  { op: "insert", kind: "picture", parent: slide, fill: { image: logo } },
  { op: "insert", kind: "picture", parent: slide, fill: { image: asset } },
  { op: "insert", kind: "shape", parent: slide, fill: "accent1" },
  { op: "update", target: "s:2", fill: { image: logo } },
] as unknown as readonly doom.Intent[]

describe("images an agent names by address", () => {
  it("names each https address and stored hash and leaves colours alone", () => {
    expect(pictures.map(imageName)).toEqual([logo, asset, undefined, logo])
  })

  it("swaps a fetched address for its stored asset in the change that names it", () => {
    const found: NamedImages = new Map([[logo, { ok: true, asset }]])
    expect(
      pictures.map((change) => withAsset(change, found)).map((change) => ("fill" in change ? change.fill : undefined)),
    ).toEqual([{ image: asset }, { image: asset }, "accent1", { image: asset }])
  })

  it("says which address could not be used, and why", () => {
    const found: NamedImages = new Map([[logo, { ok: false, refusal: "private" }]])
    const problem = imageProblem(pictures[0]!, found)
    expect(problem?.ok).toBe(false)
    expect(problem?.fields.note).toContain(`"${logo}" was not used because it leads to a private`)
    expect(imageProblem(pictures[2]!, found)).toBeUndefined()
    expect(imageProblem(pictures[1]!, new Map([[asset, { ok: true, asset }]]))).toBeUndefined()
  })
})
