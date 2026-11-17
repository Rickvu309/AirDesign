import { expect, it } from "vitest"
import { readAccountName } from "./account-name.js"

it("accepts a trimmed display name in any language", () => {
  expect(readAccountName({ name: "  Nguyễn Quân  " })).toEqual({ ok: true, name: "Nguyễn Quân" })
})

it("refuses missing, blank, overlong and control-character names", () => {
  for (const name of [undefined, 1, "", "  ", "x".repeat(101), "Ada\nLovelace", "Ada\u0000"])
    expect(readAccountName({ name })).toEqual({ ok: false, refusal: "field" })
})
