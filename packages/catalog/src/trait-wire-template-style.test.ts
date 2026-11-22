import { deckTemplates } from "@airdesign/templates"
import { describe, expect, it } from "vitest"
import { readSetChange } from "./set-wire.js"

const red = "FF0000"

describe("templateStyle.template wire form", () => {
  it("accepts every template id from packages/templates, alone or with overrides, and via legacy aliases", () => {
    for (const { id } of deckTemplates) {
      expect(readSetChange({ op: "set", target: "deck.templateStyles", templateStyle: { template: id } })).toEqual({
        ok: true,
        change: { op: "set", target: { node: "deck.templateStyles" }, templateStyle: { template: id } },
      })
    }
    expect(
      readSetChange({
        op: "set",
        target: "deck.templateStyle1",
        templateStyle: { template: "midnight", accent1: `#${red}` },
      }),
    ).toEqual({
      ok: true,
      change: {
        op: "set",
        target: { node: "deck.templateStyle1" },
        templateStyle: { template: "midnight", accent1: red },
      },
    })
    expect(readSetChange({ op: "set", target: "deck.theme", theme: { template: "editorial" } })).toEqual({
      ok: true,
      change: { op: "set", target: { node: "deck.templateStyles" }, templateStyle: { template: "editorial" } },
    })
  })

  it("refuses an unknown or non-string template id and lists the valid ids", () => {
    const ids = deckTemplates.map((each) => each.id)
    for (const value of ["sunset", "", 7, null]) {
      const read = readSetChange({ op: "set", target: "deck.templateStyles", templateStyle: { template: value } })
      expect(read.ok, String(value)).toBe(false)
      if (read.ok) continue
      expect(read.refusal).toBe("field")
      expect(read.field).toBe("templateStyle.template")
      for (const id of ids) expect(read.detail).toContain(id)
    }
  })
})
