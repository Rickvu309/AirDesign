import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { partCopies } from "./owned-parts.js"
import { newValidatorErrors } from "./validator-error.js"

describe("newValidatorErrors", () => {
  it("keeps an error the original already had", () => {
    expect(newValidatorErrors(["schema-a", "schema-b"], ["schema-b"])).toEqual([])
  })

  it("returns an error the original did not have", () => {
    expect(newValidatorErrors(["schema-a"], ["schema-a", "schema-c"])).toEqual(["schema-c"])
  })

  it("reports a second copy of an error the original already has", () => {
    expect(newValidatorErrors(["schema-a"], ["schema-a", "schema-a"])).toEqual(["schema-a"])
  })

  it("reports that second copy when another error disappears", () => {
    expect(newValidatorErrors(["schema-a", "schema-b"], ["schema-a", "schema-a"])).toEqual(["schema-a"])
  })

  it("allows the same count of an error the original already has", () => {
    expect(newValidatorErrors(["schema-a", "schema-a"], ["schema-a", "schema-a"])).toEqual([])
  })

  it("expects a part copied byte for byte to repeat its original's errors once", () => {
    const original = [
      "Schema: bad child /ppt/charts/chart2.xml @ /c:chartSpace[1]",
      "Schema: other /ppt/slides/slide1.xml",
    ]
    const copies = new Map([["ppt/charts/chart5.xml", "ppt/charts/chart2.xml"]])
    const copied = "Schema: bad child /ppt/charts/chart5.xml @ /c:chartSpace[1]"
    expect(newValidatorErrors(original, [...original, copied], copies)).toEqual([])
    expect(newValidatorErrors(original, [...original, copied, copied], copies)).toEqual([copied])
    expect(newValidatorErrors(original, [...original, copied])).toEqual([copied])
  })

  it("does not excuse an error in a copy that its original never had", () => {
    const copies = new Map([["ppt/charts/chart5.xml", "ppt/charts/chart2.xml"]])
    const fresh = "Semantic: missing part /ppt/charts/chart5.xml @ /c:chartSpace[1]/c:externalData[1]"
    expect(newValidatorErrors(["Schema: bad /ppt/charts/chart2.xml"], [fresh], copies)).toEqual([fresh])
  })
})

describe("partCopies", () => {
  it("names each added part that holds the same bytes as an original part", () => {
    const original = new Map([
      ["ppt/charts/chart2.xml", encodeUtf8("<c:chartSpace/>")],
      ["ppt/slides/slide1.xml", encodeUtf8("<p:sld/>")],
    ])
    const edited = new Map([
      ...original,
      ["ppt/charts/chart5.xml", encodeUtf8("<c:chartSpace/>")],
      ["ppt/slides/slide2.xml", encodeUtf8("<p:sld>typed</p:sld>")],
    ])
    expect([...partCopies(original, edited)]).toEqual([["ppt/charts/chart5.xml", "ppt/charts/chart2.xml"]])
  })
})
