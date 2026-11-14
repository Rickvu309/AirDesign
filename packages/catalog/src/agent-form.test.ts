import { designBytes, readDesign, type ElementRead } from "@airdesign/document"
import { expect, it } from "vitest"
import { agentColor, designOf } from "./agent-form.js"

const navy = "1F4E79"
const black = "000000"
const white = "FFFFFF"

it("writes a colour as an agent sends one: a theme slot or hex, then each transform in percent", () => {
  expect(agentColor({ scheme: "accent1" })).toBe("accent1")
  expect(agentColor({ rgb: navy })).toBe(`#${navy}`)
  expect(
    agentColor({
      scheme: "tx1",
      transforms: [
        { op: "lumMod", val: 75_000 },
        { op: "lumOff", val: 25_000 },
      ],
    }),
  ).toBe("tx1 lumMod 75 lumOff 25")
  expect(agentColor({ rgb: black, transforms: [{ op: "alpha", val: 35_500 }] })).toBe(`#${black} alpha 35.5`)
  expect(agentColor({ system: "windowText", last: black })).toBe(`#${black}`)
  expect(agentColor({ preset: "black", transforms: [{ op: "inv" }] })).toBe("black inv")
})

it("turns an element's read into its role, a design in agent units with each source, and the fields it keeps", () => {
  const read: ElementRead = {
    role: "title",
    reads: {
      fill: { value: { color: { scheme: "accent1" } }, source: "style" },
      "line.width": { value: 12_700, source: "style" },
      "line.fill": {
        value: { color: { scheme: "accent1", transforms: [{ op: "shade", val: 50_000 }] } },
        source: "style",
      },
      "effects.shadow": {
        value: {
          blur: 50_800,
          distance: 38_100,
          direction: 5_400_000,
          color: { rgb: black, transforms: [{ op: "alpha", val: 35_000 }] },
        },
        source: "style",
      },
      "text.size": { value: 3_600, source: "master" },
      "text.color": { value: { scheme: "tx1" }, source: "master" },
      "text.bold": { value: true },
      "body.anchor": { value: "b", source: "layout" },
      "box.rot": { value: 2_700_000 },
      geometry: { value: "roundRect" },
    },
    kept: ["geometry"],
  }
  expect(designOf(read)).toEqual({
    role: "title",
    design: {
      geometry: ["roundRect"],
      fill: ["accent1", "style"],
      "line.width": [1, "style"],
      "line.fill": ["accent1 shade 50", "style"],
      "effects.shadow": [`blur 4 distance 3 direction 90 #${black} alpha 35`, "style"],
      "text.size": [36, "master"],
      "text.color": ["tx1", "master"],
      "text.bold": [true],
      "body.anchor": ["b", "layout"],
      "box.rot": [45],
    },
    kept: ["geometry"],
  })
  expect(designOf({ reads: {}, kept: [] })).toEqual({})
  expect(
    designOf({ reads: { fill: { value: { gradient: [{ scheme: "accent1" }, { rgb: white }] } } }, kept: [] }).design,
  ).toEqual({ fill: [`gradient accent1, #${white}`] })
})

it("drops the last fields of a design that would not fit, so the index always takes it", () => {
  const long = { value: "A".repeat(150) }
  const read: ElementRead = {
    reads: { geometry: long, "line.dash": long, "line.head": long, "text.font": long },
    kept: [],
  }
  const { design } = designOf(read)
  expect(JSON.stringify(design).length).toBeLessThanOrEqual(designBytes)
  expect(Object.keys(design ?? {})).toEqual(["geometry", "line.dash"])
  expect(readDesign(design)).toEqual(design)
})
