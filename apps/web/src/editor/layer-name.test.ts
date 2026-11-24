import { limits } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { nameTooLongOf } from "@/copy/product-copy"
import { designCopy } from "@/copy/design-copy"
import { layerNameReading } from "./layer-name"

describe("layerNameReading", () => {
  it("keeps a trimmed layer name", () => {
    expect(layerNameReading("  Revenue card  ")).toEqual({ ok: true, name: "Revenue card" })
  })

  it("refuses an empty name and a name past the limit", () => {
    expect(layerNameReading("   ")).toEqual({ ok: false, words: designCopy.layerNameEmpty })
    expect(layerNameReading("a".repeat(limits.name))).toEqual({ ok: true, name: "a".repeat(limits.name) })
    expect(layerNameReading("a".repeat(limits.name + 1))).toEqual({
      ok: false,
      words: nameTooLongOf(limits.name),
    })
  })

  it("refuses a control character or a lone surrogate", () => {
    expect(layerNameReading("bad\u0000name")).toEqual({ ok: false, words: designCopy.layerNameEmpty })
    expect(layerNameReading("bad\ud800name")).toEqual({ ok: false, words: designCopy.layerNameEmpty })
  })
})
