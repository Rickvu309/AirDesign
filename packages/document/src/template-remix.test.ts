import { expect, it } from "vitest"
import { cycledColor, presentSlots } from "./template-remix.js"

const present = presentSlots({ dk1: "111111", lt1: "EEEEEE", accent1: "AA0000", accent2: "00AA00", folHlink: "770077" })

it("rotates a template color one step through the slots the template style actually has", () => {
  expect(present).toEqual(["dk1", "lt1", "accent1", "accent2", "folHlink"])
  expect(cycledColor({ scheme: "accent1" }, present, {})).toEqual({ scheme: "accent2" })
  expect(cycledColor({ scheme: "folHlink" }, present, {})).toEqual({ scheme: "dk1" })
  expect(cycledColor({ scheme: "tx1" }, present, { tx1: "dk1" })).toEqual({ scheme: "lt1" })
  expect(cycledColor({ scheme: "accent2", transforms: [{ op: "lumMod", val: 60000 }] }, present, {})).toEqual({
    scheme: "folHlink",
    transforms: [{ op: "lumMod", val: 60000 }],
  })
})

it("leaves an explicit colour, a missing slot, and a one-colour template alone", () => {
  expect(cycledColor({ rgb: "123456" }, present, {})).toBeNull()
  expect(cycledColor({ scheme: "accent6" }, present, {})).toBeNull()
  expect(cycledColor({ scheme: "bg1" }, present, {})).toBeNull()
  expect(cycledColor({ scheme: "accent1" }, ["accent1"], {})).toBeNull()
  expect(cycledColor(null, present, {})).toBeNull()
})
