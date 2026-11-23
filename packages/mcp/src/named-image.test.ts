import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { imageNames, imageProblem, withAssets, type NamedImages } from "./named-image.js"

const logo = "https://images.example.com/logo.png"
const asset = "b".repeat(64)
const slide = "s:1"

const pictures = [
  { op: "add", kind: "picture", slide, fill: { image: logo } },
  { op: "add", kind: "picture", slide, fill: { image: asset } },
  { op: "add", kind: "shape", slide, fill: "accent1" },
  { op: "set", target: "s:2", fill: { image: logo } },
] as unknown as readonly doom.AgentChange[]

describe("images an agent names by address", () => {
  it("lists each https address and stored hash once and leaves colours alone", () => {
    expect(imageNames(pictures)).toEqual([logo, asset])
  })

  it("swaps a fetched address for its stored asset in every change that names it", () => {
    const found: NamedImages = new Map([[logo, { ok: true, asset }]])
    expect(withAssets(pictures, found).map((change) => ("fill" in change ? change.fill : undefined))).toEqual([
      { image: asset },
      { image: asset },
      "accent1",
      { image: asset },
    ])
  })

  it("says which change named an address that could not be used, and why", () => {
    const found: NamedImages = new Map([[logo, { ok: false, refusal: "private" }]])
    const problem = imageProblem(pictures, found)
    expect(problem?.ok).toBe(false)
    expect(problem?.content[0]?.text).toContain(`Change 1: "${logo}" was not used because it leads to a private`)
    expect(problem?.content[0]?.text).toContain("Change 4:")
    expect(
      imageProblem(
        pictures,
        new Map([
          [logo, { ok: true, asset }],
          [asset, { ok: true, asset }],
        ]),
      ),
    ).toBeUndefined()
  })
})
